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
@RouteConfig('/server')
@Component({
  selector: 'server',
  template: `
    <div layout="column" flex layout-padding layout-fill>
      <div layout="row" class="button-row">
        <md-button class="start-stop" ng-show="!vm.server.isRunning" ng-click="vm.startServer()">Start Server</md-button>
        <md-button class="start-stop md-primary" ng-show="vm.server.isRunning" ng-click="vm.stopServer()">Stop Server</md-button>
        <md-button class="start-stop" ng-click="vm.showFolder()">Install Dir</md-button>

        <md-switch ng-model="vm.connectedToLocalhost" aria-label="Choose API connection" ng-change="vm.connectToLocalhostChanged()">
          <md-tooltip md-direction="top">
            Connect client API to remotehost or to your local machine
          </md-tooltip>
          Client API connected to {{ vm.connectedToLocalhost ? 'localhost' : vm.remotehostDisplay }}
        </md-switch>
        <span flex></span>
        <div layout="row" layout-align="center center" class="mining-stats" ng-show="vm.isMining">
          <span>Remaining : </span>
          <span class="mining-stats-val">{{vm.miningRemaining}}</span>
          <span>Deadline : </span>
          <span class="mining-stats-val">{{vm.miningDeadline}}</span>
          <span>Hittime : </span>
          <span class="mining-stats-val">{{vm.miningHittime}}</span>
        </div>
        <md-button ng-show="vm.user.unlocked&&!vm.isMining" ng-disabled="!vm.server.isReady" class="start-stop" ng-click="vm.startMining()">Start Mining</md-button>
        <md-button ng-show="vm.user.unlocked&&vm.isMining" ng-disabled="!vm.server.isReady" class="start-stop md-primary" ng-click="vm.stopMining()">Stop Mining</md-button>
        <a ng-show="!vm.user.unlocked" class="start-stop" href="#/login">Sign in to start mining</a>

      </div>
      <div layout="column" flex class="console" layout-fill>
        <md-virtual-repeat-container md-top-index="vm.topIndex" flex layout-fill layout="column"
            virtual-repeat-flex-helper id="server-console-container">
          <pre md-virtual-repeat="item in vm" md-on-demand aria-label="Entry">
            <span ng-if="!item.timestamp">{{item.message}}</span>
            <span ng-if="item.timestamp">
              <span class="date">{{item.timestamp}}&nbsp;<span class="severity {{item.severity}}">{{item.severity}}</span>&nbsp;<span class="message">{{item.message}}</span>
            </span>
          </pre>
        </md-virtual-repeat-container>
      </div>
    </div>
  `
})
@Inject('$scope','server','heat','user','settings','$mdToast')
class ServerComponent {
  private ROW_HEIGHT = 12; // must match the `server .console pre { height: 12px }` style rule above

  private console: any;
  private onOutput: IEventListenerFunction;
  private calculatedTopIndex = 0;
  private topIndex = 0;
  private consoleRowCount = 0;
  private isMining = false;
  private miningRemaining: any = '*';
  private miningDeadline: any = '*';
  private miningHittime: any = '*';
  private hostLocal: string;
  private hostRemote: string;
  private portLocal: string;
  private portRemote: string;
  private connectedToLocalhost: boolean;
  private remotehostDisplay: string;

  /* 2017-01-27 23:22:30 INFO: Pushed block 13300804393767116009 with height 2925 */
  //private msgRegExp = /^([\d-]+\s[\d:]+)\s(\w+):\s(.*)/;

  /* 2017-04-01 19:00:17 [pool-5-thread-3] INFO c.heatledger.BlockchainProcessorImpl - Pushed block 4762652772805132303 at height 659 received 2017-03-18 06:27:42 from 37.139.25.98 */
  private msgRegExp = /^([\d-]+\s[\d:]+)\s(.+)\s-\s(.*)/;

  constructor(private $scope:angular.IScope,
              public server: ServerService,
              private heat: HeatService,
              private user: UserService,
              private settings: SettingsService,
              private $mdToast: angular.material.IToastService) {

    if (user.unlocked) {
      heat.subscriber.blockPushed({generator:user.account}, ()=>{this.updateMiningInfo()});
      heat.subscriber.blockPopped({generator:user.account}, ()=>{this.updateMiningInfo()});
    }
    else {
      let listener = () => { this.updateMiningInfo() };
      user.on(UserService.EVENT_UNLOCKED, listener);
      $scope.$on('$destroy',()=>user.removeListener(UserService.EVENT_UNLOCKED, listener));
    }

    this.hostLocal  = this.settings.get(SettingsService.HEAT_HOST_LOCAL);
    this.hostRemote = this.settings.get(SettingsService.HEAT_HOST_REMOTE);
    this.portLocal  = this.settings.get(SettingsService.HEAT_PORT_LOCAL);
    this.portRemote = this.settings.get(SettingsService.HEAT_PORT_REMOTE);
    this.connectedToLocalhost = this.isConnectedToLocalhost();
    this.onOutput = () => {
      $scope.$evalAsync(()=> {
        this.calculatedTopIndex = this.determineTopIndex();
        if (!(this.topIndex < (this.calculatedTopIndex-5)) || this.consoleRowCount < this.getLength()) {
          this.topIndex = this.calculatedTopIndex;
        }
      })
    };
    server.addListener('output',this.onOutput);
    $scope.$on('$destroy',()=>{
      server.removeListener('output',this.onOutput);
    });
    this.updateMiningInfo();
    window.setTimeout(()=>{
      this.topIndex = this.determineTopIndex();
      this.onOutput();
    },3000);

    this.remotehostDisplay = this.hostRemote.replace('https://','');
  }

  showFolder() {
    require('electron').shell.showItemInFolder(this.server.getAppDir('.'))
  }

  /* md-virtual-repeat */
  getItemAtIndex(index) {
    return this.render(this.server.buffer[index]);
  }

  /* md-virtual-repeat */
  getLength() {
    return this.server.buffer.length;
  }

  connectToLocalhostChanged() {
    this.toggleConnectToLocalhost();
  }

  isConnectedToLocalhost(): boolean {
    return this.settings.get(SettingsService.HEAT_HOST) == this.hostLocal &&
           this.settings.get(SettingsService.HEAT_PORT) == this.portLocal;
  }

  toggleConnectToLocalhost() {
    var host = this.isConnectedToLocalhost() ? this.hostRemote : this.hostLocal;
    var port = this.isConnectedToLocalhost() ? this.portRemote : this.portLocal;
    this.settings.put(SettingsService.HEAT_HOST, host);
    this.settings.put(SettingsService.HEAT_PORT, port);
  }

  startServer() {
    this.server.startServer()
    this.$mdToast.show(this.$mdToast.simple().textContent("In some cases you need to Start the server A SECOND TIME!\n"+
      "Wheter that's the case is indicated at the end of the log output (the colored text with black background).").hideDelay(10000));
  }

  stopServer() {
    this.server.stopServer()
  }

  determineRowCount() {
    var el = document.getElementById('server-console-container');
    return Math.round(el.clientHeight / this.ROW_HEIGHT);
  }

  determineTopIndex() {
    this.consoleRowCount = this.determineRowCount();
    return Math.max(0, this.getLength()-this.consoleRowCount+2);
  }

  /* msg is a string object from server service buffer. when asked for again we return the same instance */
  render(msg) {
    if (angular.isUndefined(msg))
      return msg;
    if (angular.isUndefined(msg.rendered)) {
      var match = this.msgRegExp.exec(msg);
      msg.rendered = match ? { timestamp: match[1], severity: match[2], message: match[3] } : { message: msg };
    }
    return msg.rendered;
  }

  startMining() {
    this.heat.api.startMining(this.user.secretPhrase).then((info) => {
      this.updateMiningInfo();
    });
  }

  stopMining() {
    this.heat.api.stopMining(this.user.secretPhrase).then((info) => {
      this.updateMiningInfo();
    });
  }

  updateMiningInfo() {
    if (this.user.unlocked) {
      this.heat.api.getMiningInfo(this.user.secretPhrase).then((info)=> {
        this.$scope.$evalAsync(() => {
          if (info[0]) {
            this.isMining = true;
            this.miningRemaining = info[0].remaining;
            this.miningDeadline = info[0].deadline;
            this.miningHittime = info[0].hitTime;
          }
          else {
            this.isMining = false;
          }
        })
      }, () => {
        this.$scope.$evalAsync(() => {
          this.isMining = false;
        });
      });
    }
  }
}