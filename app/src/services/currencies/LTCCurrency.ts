class LTCCurrency implements ICurrency {

  private ltcBlockExplorerService: LtcBlockExplorerService
  public symbol = 'LTC'
  public homePath
  private pendingTransactions: LtcPendingTransactionsService
  private user: UserService

  constructor(public secretPhrase: string, public address: string) {
    this.ltcBlockExplorerService = heat.$inject.get('ltcBlockExplorerService')
    this.user = heat.$inject.get('user')
    this.homePath = `/ltc-account/${this.address}`
    this.pendingTransactions = heat.$inject.get('ltcPendingTransactions')
  }

  /* Returns the currency balance, fraction is delimited with a period (.) */
  getBalance(): angular.IPromise<string> {
    return this.ltcBlockExplorerService.getBalance(this.address).then(
      balance => {
        let balanceUnconfirmed = parseFloat(balance) / 100000000;
        return utils.commaFormat(new Big(balanceUnconfirmed + "").toFixed(8))
      }
    )
  }

  /* Register a balance changed observer, unregister by calling the returned
     unregister method */
  subscribeBalanceChanged(handler: () => void): () => void {
    return function () { }
  }

  /* Manually invoke the balance changed observers */
  notifyBalanceChanged() {
  }

  /* Invoke SEND currency dialog */
  invokeSendDialog = ($event) => {
    this.sendLtc($event).then(
      data => {
        let address = this.user.account
        let timestamp = new Date().getTime()
        this.pendingTransactions.add(address, data.txId, timestamp)
      },
      err => {
        if (err) {
          dialogs.alert($event, 'Send LTC Error', 'There was an error sending this transaction: ' + JSON.stringify(err))
        }
      }
    )
  }

  /* Invoke SEND token dialog */
  invokeSendToken($event) {

  }

  sendLtc($event) {
    function DialogController2($scope: angular.IScope, $mdDialog: angular.material.IDialogService) {
      $scope['vm'].cancelButtonClick = function () {
        $mdDialog.cancel()
      }

      let createTx = function (isForFeeEstimation: boolean = false) {
        let user = <UserService>heat.$inject.get('user')
        let ltcCryptoService = <LTCCryptoService>heat.$inject.get('ltcCryptoService')
        let addressPrivateKeyPair = { address: user.currency.address, privateKey: user.secretPhrase, publicKey: user.publicKey }
        let amountInSatoshi = $scope['vm'].data.amount * 100000000 === 0 ? 10000 : $scope['vm'].data.amount * 100000000;
        let feeInSatoshi
        if (!isForFeeEstimation)
          feeInSatoshi = $scope['vm'].data.fee * 100000000;
        else
          feeInSatoshi = 0
        let to = $scope['vm'].data.recipient
        let txObject = {
          tx: {
            inputs: [
              {
                addresses: [addressPrivateKeyPair.address]
              }],
            outputs: [{
              addresses: [to], value: amountInSatoshi
            }],
            fees: 2260
          },
          privateKey: addressPrivateKeyPair.privateKey,
          fee: 2260,
          sender: addressPrivateKeyPair.address,
          recipient: to,
          value: amountInSatoshi,
          publicKey: addressPrivateKeyPair.publicKey
        }
        return txObject
      }

      $scope['vm'].okButtonClick = ($event) => {
        let ltcBlockExplorerService = <LtcBlockExplorerService>heat.$inject.get('ltcBlockExplorerService')
        $scope['vm'].disableOKBtn = true
        let txObject = createTx(false)
        let ltcCryptoService = <LTCCryptoService>heat.$inject.get('ltcCryptoService');
        ltcCryptoService.signTransaction(txObject).then(signedTx => {
          ltcBlockExplorerService.broadcast(signedTx).then(
            data => {
              $mdDialog.hide(data).then(() => {
                dialogs.alert(event, 'Success', `TxId: ${data.tx.hash}`);
              })
            },
            err => {
              $mdDialog.hide(null).then(() => {
                dialogs.alert(event, 'Error', err.message);
              })
            }
          )
        })

      }
      $scope['vm'].disableOKBtn = false
      $scope['vm'].data = {
        amount: '',
        recipient: '',
        recipientInfo: '',
        fee: '0.0000226'
      }

      /* Lookup recipient info and display this in the dialog */
      let lookup = utils.debounce(function () {
        let ltcBlockExplorerService = <LtcBlockExplorerService>heat.$inject.get('ltcBlockExplorerService')
        ltcBlockExplorerService.getAddressInfo($scope['vm'].data.recipient).then(
          info => {
            $scope.$evalAsync(() => {
              let balance = (info.final_balance / 100000000).toFixed(8)
              $scope['vm'].data.recipientInfo = `Balance: ${balance} LTC`
            })
          },
          error => {
            $scope.$evalAsync(() => {
              $scope['vm'].data.recipientInfo = error.message || 'Invalid'
            })
          }
        )
      }, 1000, false)
      $scope['vm'].recipientChanged = function () {
        let ltcCryptoService = <LTCCryptoService>heat.$inject.get('ltcCryptoService')
        $scope['vm'].data.recipientInfo = ''
        lookup()
        $scope['vm'].data.txBytes = []
        ltcCryptoService.signTransaction(createTx(true), true).then(rawTx => {
          $scope['vm'].data.txBytes = converters.hexStringToByteArray(rawTx)
          $scope['vm'].data.fee = $scope['vm'].data.txBytes.length * $scope['vm'].data.estimatedFee / 100000000
        })
      }

      $scope['vm'].amountChanged = function () {
        let ltcCryptoService = <LTCCryptoService>heat.$inject.get('ltcCryptoService')
        $scope['vm'].data.txBytes = []
        ltcCryptoService.signTransaction(createTx(true), true).then(rawTx => {
          $scope['vm'].data.txBytes = converters.hexStringToByteArray(rawTx)
          $scope['vm'].data.fee = $scope['vm'].data.txBytes.length * $scope['vm'].data.estimatedFee / 100000000
        })
      }

      function getEstimatedFee() {
        let ltcBlockExplorerService = <LtcBlockExplorerService>heat.$inject.get('ltcBlockExplorerService')
        ltcBlockExplorerService.getEstimatedFee().then(data => {
          if (data != -1)
            $scope['vm'].data.estimatedFee = data / 1000;
        })
      }
      getEstimatedFee();
    }

    let $q = heat.$inject.get('$q')
    let $mdDialog = <angular.material.IDialogService>heat.$inject.get('$mdDialog')

    let deferred = $q.defer<{ txId: string }>()
    $mdDialog.show({
      controller: DialogController2,
      parent: angular.element(document.body),
      targetEvent: $event,
      clickOutsideToClose: false,
      controllerAs: 'vm',
      template: `
        <md-dialog>
          <form name="dialogForm">
            <md-toolbar>
              <div class="md-toolbar-tools"><h2>Send Ltc</h2></div>
            </md-toolbar>
            <md-dialog-content style="min-width:500px;max-width:600px" layout="column" layout-padding>
              <div flex layout="column">

                <md-input-container flex >
                  <label>Recipient</label>
                  <input ng-model="vm.data.recipient" ng-change="vm.recipientChanged()" required name="recipient">
                  <span ng-if="vm.data.recipientInfo">{{vm.data.recipientInfo}}</span>
                </md-input-container>

                <md-input-container flex >
                  <label>Amount in Ltc</label>
                  <input ng-model="vm.data.amount" ng-change="vm.amountChanged()" required name="amount">
                </md-input-container>

                <md-input-container flex>
                  <label>Fee in Ltc</label>
                  <input ng-model="vm.data.fee" required name="fee">
                </md-input-container>
              </div>
            </md-dialog-content>
            <md-dialog-actions layout="row">
              <md-button ng-click="0" ng-disabled="true" class="fee" style="max-width:140px !important">Fee/Byte {{vm.data.estimatedFee}} Sat</md-button>
              <span flex></span>
              <md-button class="md-warn" ng-click="vm.cancelButtonClick()" aria-label="Cancel">Cancel</md-button>
              <md-button ng-disabled="!vm.data.recipient || !vm.data.amount || vm.disableOKBtn"
                  class="md-primary" ng-click="vm.okButtonClick()" aria-label="OK">OK</md-button>
            </md-dialog-actions>
          </form>
        </md-dialog>
      `
    }).then(deferred.resolve, deferred.reject);
    return deferred.promise
  }


}