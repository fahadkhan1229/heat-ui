/*
 * The MIT License (MIT)
 * Copyright (c) 2017 Heat Ledger Ltd.
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
  selector: 'explorerSearch',
  inputs: ['type','query'],
  template: `
    <div layout="row" flex layout-fill>
      <md-input-container flex>
        <label>Search for account id, account public names, transaction id, block id or block height</label>
        <input name="search-text" ng-model="vm.query" ng-keypress="vm.onKeyPress($event)">
      </md-input-container>
    </div>
  `
})
@Inject('$scope','$location')
class ExplorerSearchComponent {
  type: string; // @input
  query: string; // @input

  constructor(private $scope: angular.IScope, private $location: angular.ILocationService) {}

  onKeyPress($event) {
    if ($event.keyCode == 13) {
      let type = this.type || 'search';
      let query = this.query || '';
      this.$location.path(`/explorer-results/${type}/${query}`);
    }
  }
}