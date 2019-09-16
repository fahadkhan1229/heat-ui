@Service('zecBlockExplorerService')
@Inject('http', '$q', '$interval', '$window')
class ZecBlockExplorerService {
  private zcashExplorer: string;

  constructor(private http: HttpService,
              private $q: angular.IQService,
              private $interval: angular.IIntervalService,
              private $window: angular.IWindowService) {
    this.zcashExplorer = 'https://explorer.zecmate.com/api';
  }

  public getBalance = (address: string) => {
    let deferred = this.$q.defer<any>();
    this.getAddressInfo(address).then(info => {
      if (info) {
        deferred.resolve(info.balance)
      }
      deferred.resolve(0)
    }, ()=> {
      deferred.reject(`Unable to fetch ZEC balance`)
    })
    return deferred.promise
  }

  public getTransactions (address: string, pageNum: number) {
    let deferred = this.$q.defer<any>();
    let url = `${this.zcashExplorer}/txs?address=${address}&pageNum=${pageNum}`
    this.http.get(url).then(info => {
      let data = JSON.parse(typeof info === "string" ? info : JSON.stringify(info))
      if (data) {
        deferred.resolve(data.txs)
      }
    }, ()=> {
      deferred.reject(`Unable to fetch ZEC transactions`)
    })
    return deferred.promise
  }

  public getTransactionCount = (address: string): angular.IPromise<any> => {
    let deferred = this.$q.defer<any>();
    this.getAddressInfo(address).then(info => {
      if (info) {
        let totalTransactions = info.txApperances
        deferred.resolve(totalTransactions)
      }
      deferred.resolve(0)
    }, ()=> {
      deferred.reject(`Unable to fetch Zcash transaction count`)
    })
    return deferred.promise
	}

  public getAddressInfo = (address: string): angular.IPromise<any> => {
    let deferred = this.$q.defer<any>();
    let url = `${this.zcashExplorer}/addr/${address}/?noTxList=1`
    this.http.get(url).then(info => {
      let data = JSON.parse(typeof info === "string" ? info : JSON.stringify(info))
      if (data) {
        deferred.resolve(data)
      }
    }, ()=> {
      deferred.reject(`Unable to fetch ZEC address data`)
    })
    return deferred.promise
  }
}