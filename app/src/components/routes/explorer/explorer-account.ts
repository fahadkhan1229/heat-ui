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
@RouteConfig('/explorer-account/:account/:type')
@Component({
  selector: 'explorerAccount',
  inputs: ['account','type'],
  template: `
    <div layout="column" flex layout-fill layout-padding >
      <explorer-search layout="column" type="''" query="''"></explorer-search>
      <div layout="row" class="explorer-detail">
        <div layout="column">
          <div class="col-item">
            <div class="title">
              Account:
            </div>
            <div class="value">
              <a href="#/explorer-account/{{vm.account}}">{{vm.accountName||vm.account}}</a>
            </div>
          </div>
          <div class="col-item">
            <div class="title">
              Numeric account id:
            </div>
            <div class="value">
              {{vm.account}}
            </div>
          </div>
          <div class="col-item">
            <div class="title">
              Balance:
            </div>
            <div class="value">
              {{vm.balanceUnconfirmed}} HEAT
            </div>
          </div>
        </div>
        <div layout="column">
          <div class="col-item">
            <div class="title">
              Effective bal:
            </div>
            <div class="value">
              {{vm.effectiveBalance}} HEAT
            </div>
          </div>
          <div class="col-item">
            <div class="title">
              Lease:
            </div>
            <div class="value">
              <span ng-if="vm.currentLessee=='0'">None</span>
              <span ng-if="vm.currentLessee!='0'">
                <a href="#/explorer-account/{{vm.currentLessee}}">{{vm.currentLesseeName}}</a> period {{vm.currentLeasingHeightFrom}}/{{vm.currentLeasingHeightTo}} remaining {{vm.currentLeasingRemain}}
              </span>
            </div>
          </div>
          <div class="col-item">
            <div class="title">
              Next lease:
            </div>
            <div class="value">
              <span ng-if="vm.nextLessee=='0'">None</span>
              <span ng-if="vm.nextLessee!='0'">
                <a href="#/explorer-account/{{vm.nextLessee}}">{{vm.nextLesseeName}}</a> period {{vm.nextLeasingHeightFrom}}/{{vm.nextLeasingHeightTo}}
              </span>
            </div>
          </div>
        </div>
        <div layout="column" flex>
          <div class="col-item" flex layout-fill>
            <div class="title">
              Assets:
            </div>
            <div class="scrollable">
              <div class="value" ng-repeat="item in vm.assetInfos">
                <span class="balance">{{item.balance}}</span>
                <span class="symbol"><b>{{item.symbol}}</b></span>
                <span class="name">
                  <a ng-click="vm.showDescription($event, item)">{{item.name}}</a>
                </span>
                <span class="issuer">
                  Issued by: <a href="#/explorer-account/{{item.issuer}}">{{item.issuerPublicName||item.issuer}}</a>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div layout="row" layout-align="start center" class="type-row">
        <md-button ng-class="{'active':vm.type=='accounts'}"
          ng-disabled="vm.type=='transactions'"
          ng-href="#/explorer-account/{{vm.account}}/transactions">Transactions</md-button>
        <md-button ng-class="{'active':vm.type=='blocks'}"
          ng-disabled="vm.type=='blocks'"
          ng-href="#/explorer-account/{{vm.account}}/blocks">Blocks</md-button>
        <md-button ng-class="{'active':vm.type=='assets'}"
          ng-disabled="vm.type=='assets'"
          ng-href="#/explorer-account/{{vm.account}}/assets">Assets</md-button>
      </div>

      <virtual-repeat-transactions hide-label="true" layout="column" flex layout-fill account="vm.account"></virtual-repeat-transactions>
    </div>
  `
})
@Inject('$scope','heat','assetInfo','$q')
class ExploreAccountComponent {
  account: string; // @input
  type: string; // @input

  accountName: string;
  email: string;
  publicKey: string;
  firstSeen: string;
  lease: string;
  leaseBlocksRemain: string;
  forged: string;
  effectiveBalance: string;
  balanceUnconfirmed: string;
  balanceConfirmed: string;
  assetInfos: Array<AssetInfo> = [];

  currentLessee: string;
  currentLesseeName: string;
  currentLeasingHeightFrom: number;
  currentLeasingHeightTo: number;
  currentLeasingRemain: number;
  nextLessee: string;
  nextLesseeName: string;
  nextLeasingHeightFrom: number;
  nextLeasingHeightTo: number;

  constructor(private $scope: angular.IScope,
              private heat: HeatService,
              private assetInfo: AssetInfoService,
              private $q: angular.IQService) {
    this.refresh();
    heat.subscriber.balanceChanged({ account: this.account, currency: "0" }, () => {
      this.refresh();
    }, $scope);
  }

  refresh() {
    this.accountName = "*";
    this.email = "*";
    this.publicKey = "*";
    this.firstSeen = "*";
    this.lease = "*";
    this.leaseBlocksRemain = "*";
    this.forged = "*";
    this.effectiveBalance = "*";
    this.balanceUnconfirmed = "*";
    this.balanceConfirmed = "*";

    this.heat.api.getPublicKey(this.account).then((publicKey)=>{
      this.$scope.$evalAsync(()=>{
        this.publicKey = publicKey;
      })
    });

    this.heat.api.getAccountByNumericId(this.account).then((account)=>{
      this.$scope.$evalAsync(()=>{
        this.accountName = account.publicName;
        this.balanceConfirmed = utils.formatQNT(account.balance, 8);
        this.effectiveBalance = utils.formatQNT(account.effectiveBalance, 8);
        this.balanceUnconfirmed = utils.formatQNT(account.unconfirmedBalance, 8);
        this.currentLessee = account.currentLessee;
        this.currentLesseeName = account.currentLesseeName || account.currentLessee;
        this.currentLeasingHeightFrom = account.currentLeasingHeightFrom;
        this.currentLeasingHeightTo = account.currentLeasingHeightTo;
        this.nextLessee = account.nextLessee;
        this.nextLesseeName = account.nextLesseeName || account.nextLessee;
        this.nextLeasingHeightFrom = account.nextLeasingHeightFrom;
        this.nextLeasingHeightTo = account.nextLeasingHeightTo;
      });
      if (this.currentLessee != "0") {
        this.heat.api.getBlockchainStatus().then(status=>{
          this.$scope.$evalAsync(()=>{
            this.currentLeasingRemain = status.lastBlockchainFeederHeight - account.currentLeasingHeightTo;
          })
        })
      }
    });

    this.getAccountAssets().then(assetInfos=>{
      this.$scope.$evalAsync(()=>{
        this.assetInfos = assetInfos.map(info => {
          info['balance'] = utils.formatQNT(info.userBalance, 8);
          return info;
        });
      })
    })
  }

  showDescription($event, info: AssetInfo) {
    dialogs.assetInfo($event, info);
  }

  private getAccountAssets(): angular.IPromise<Array<AssetInfo>> {
    let deferred = this.$q.defer();
    this.heat.api.getAccountBalances(this.account, "0", 1, 0, 100).then(balances => {
      let assetInfos: Array<AssetInfo> = [];
      let promises = [];
      balances.forEach(balance=>{
        if (balance.id != '0') {
          promises.push(
            this.assetInfo.getInfo(balance.id).then(info=>{
              assetInfos.push(angular.extend(info, {
                userBalance: balance.balance
              }))
            })
          );
        }
      });
      if (promises.length > 0) {
        this.$q.all(promises).then(()=>{
          assetInfos.sort((a,b)=>{
            var textA = a.symbol.toUpperCase();
            var textB = b.symbol.toUpperCase();
            return (textA < textB) ? -1 : (textA > textB) ? 1 : 0;
          });
          deferred.resolve(assetInfos);
        }, deferred.reject);
      }
      else {
        deferred.resolve([]);
      }
    }, deferred.reject);
    return deferred.promise;
  }
}
