@Service('bchTransactionsProviderFactory')
@Inject('http','$q', 'bchBlockExplorerService')
class BchTransactionsProviderFactory  {
  constructor(private http: HttpService,
              private $q: angular.IQService,
              private bchBlockExplorerService: BchBlockExplorerService) {}

  public createProvider(account: string): IPaginatedDataProvider {
    return new BchTransactionsProvider(this.http, this.$q, this.bchBlockExplorerService, account);
  }
}

class BchTransactionsProvider implements IPaginatedDataProvider {

  constructor(private http: HttpService,
              private $q: angular.IQService,
              private bchBlockExplorerService: BchBlockExplorerService,
              private account: string) {}

  /* Be notified this provider got destroyed */
  public destroy() {}

  /* The number of items available */
  public getPaginatedLength(): angular.IPromise<number> {
    let deferred = this.$q.defer<number>()
    this.bchBlockExplorerService.getAddressInfo(this.account).then(result => {
      deferred.resolve(result.txs)
    }, () => {
      deferred.reject()
    })

    return <angular.IPromise<number>>deferred.promise;
  }

  /* Returns results starting at firstIndex and up to and including lastIndex */
  public getPaginatedResults(firstIndex: number, lastIndex: number): angular.IPromise<Array<any>> {
    let pageNum = (lastIndex / 10) || 0;
    let pageSize = (lastIndex - firstIndex) || 10;
    return this.bchBlockExplorerService.getTransactions(this.account, pageNum, pageSize)
  }

}
