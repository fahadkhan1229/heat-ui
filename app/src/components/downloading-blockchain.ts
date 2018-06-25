/*
 * The MIT License (MIT)
 * Copyright (c) 2016 Heat Ledger Ltd.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of
 * this software and associated documentation files (the "Software"), to deal in
 * the Software without restriction, including without limitation the rights to
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
 * the Software, and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 * */
@Component({
  selector: 'downloadingBlockchain',
  template: `
    <div layout="column" flex layout-fill ng-show="vm.showComponent">
      <md-progress-linear md-mode="indeterminate"></md-progress-linear>
      <center><div><b>Attention!!</b></div>
      <div>Downloading blockchain last block height: {{vm.lastBlockHeight}}, time {{vm.lastBlockTime}}</div></center>
    </div>
  `
})
@Inject('$scope','heat','$interval','settings')
class DownloadingBlockchainComponent {
  showComponent = false;
  lastBlockHeight = 0;
  lastBlockTime = 0;
  constructor(private $scope: angular.IScope,
              private heat: HeatService,
              private $interval: angular.IIntervalService,
              private settings: SettingsService) {
    this.refresh();

    let interval = $interval(()=>{ this.refresh() }, 60*1000, 0, false);
    let checkServerHealthInterval = $interval(()=>{ this.checkServerHealth() }, 33*1000, 0, false);

    $scope.$on('$destroy',()=>{
      $interval.cancel(interval);
      $interval.cancel(checkServerHealthInterval);
    });

    this.checkServerHealth();
  }

  refresh() {
    this.heat.api.getBlockchainStatus().then(status=>{
      this.$scope.$evalAsync(()=>{
        let format = this.settings.get(SettingsService.DATEFORMAT_DEFAULT);
        let date = utils.timestampToDate(status.lastBlockTimestamp);
        this.lastBlockTime = dateFormat(date, format);
        this.lastBlockHeight = status.numberOfBlocks;
        if ((Date.now() - date.getTime()) > 1000 * 60 * 60) {
          this.showComponent = true;
        }
        else {
          this.showComponent = false;
        }
      })
    }, ()=>{
      this.$scope.$evalAsync(()=>{
        this.showComponent = false;
      })
    })
  }

  /**
   * Failover procedure.
   * Compares health of known servers with current server.
   * If other health is significantly over current server health then switches to other server.
   */
  checkServerHealth() {
    let knownServers = this.settings.getKnownServers();

    let currentServerHealth: IHeatServerHealth;
    let promises = [];
    knownServers.forEach(server => {
      promises.push(
        this.heat.api.getServerHealth(server.host, server.port).then(health=> {
          server["health"] = health;
          server["error"] = null;
        }).catch(function (err) {
          server["health"] = null;
          server["error"] = err;
          return err;
        })
      )
    });

    let minEqualityServersNumber = heat.isTestnet ? 3 : 10;

    Promise.all(promises).then(() => {
      let currentServerIsAlive = false;
      let currentServer = null;

      //find the health of the current server
      knownServers.forEach(server => {
        let health: IHeatServerHealth = server["health"];
        server["score"] = null;
        if (health)
        server["score"] = 0; // has health means has min score
        if (server.host == this.settings.get(SettingsService.HEAT_HOST) && server.port == this.settings.get(SettingsService.HEAT_PORT)) {
          currentServerHealth = health;
          currentServer = server;
          server["score"] = 0;  // better than self is 0
          //if the server response is nothing then server is down
          currentServerIsAlive = !(server["error"] && !server["error"]["data"]);
        }
      });

      if (currentServerIsAlive && ! currentServerHealth)
        return;  //has no health (old version or monitoring API is disabled) so nothing to compare

      //compare health of other servers with health of the current server
      knownServers.forEach(server => {
        let health: IHeatServerHealth = server["health"];
        if (!health || !currentServerHealth || !(health.balancesEquality[1] >= minEqualityServersNumber))
          return;
        let mismatches = health.balancesEquality[0] / health.balancesEquality[1];
        let currentServerMismatches = currentServerHealth.balancesEquality[0] / currentServerHealth.balancesEquality[1];
        let balancesEstimation = (mismatches < 0.9 * currentServerMismatches
          && health.balancesEquality[2] > 0.8 * currentServerHealth.balancesEquality[2])
          ? 1
          : (mismatches > currentServerMismatches || health.balancesEquality[2] < 0.7 * currentServerHealth.balancesEquality[2])
            ? -1
            : 0;
        let blocksEstimation = (health.lastBlockHeight > 2 + currentServerHealth.lastBlockHeight)
          ? 1
          : (health.lastBlockHeight + 2 < currentServerHealth.lastBlockHeight)
            ? -1
            : 0;
        let connected = health.peersIndicator.connected / health.peersIndicator.all;
        let currentServerConnected = currentServerHealth.peersIndicator.connected / currentServerHealth.peersIndicator.all;
        let peerEstimation = (0.8 * connected > currentServerConnected)
          ? 1
          : (connected < 0.8 * currentServerConnected)
            ? -1
            : 0;
        if (blocksEstimation == 1 && balancesEstimation >= 0 && peerEstimation >= 0)
          server["score"] = blocksEstimation + balancesEstimation + peerEstimation;
        else
          server["score"] = 0;
      });
      let best;
      knownServers.forEach(server => {
        if (! currentServerIsAlive || server["score"] >= 0)
          if (!best || server["score"] > best["score"] || (server["score"] != null && best["score"] == null))
            best = server;
      });
      if (best && best != currentServer) {
        this.settings.setCurrentServer(best);
        if (currentServer)
          alert("HEAT server API address switched from \n"
            + currentServer.host + ":" + currentServer.port +
            "\nto\n" + best.host + ":" + best.port);
        else
          alert("HEAT server API address switched to\n" + best.host + ":" + best.port);
      }
    })
  }

}
