/*
 * The MIT License (MIT)
 * Copyright (c) 2019 Heat Ledger Ltd.
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
  selector: 'p2pMessagesViewer',
  inputs: ['publickey','@containerId'],
  styles: [`
    .messages {
      overflow: auto;
    }    
    .message-entry {
      color: white;
      margin-bottom: 14px;
      margin-right: 10px;
      // max-width: 85%;
    }
    .message-entry .message-content {
      white-space: pre-line;
    }
    .message-entry md-icon {
      color: green;
      margin: 0 12px 0 0;
    }
    .message-entry .header {
      padding-bottom: 6px;
      color: grey;
    }
    .message-entry .menu-button {
      color: grey !important;
    }
    .message-entry div.message {
      width: 100%;
    }
    // .outgoing {
    //   align-self: flex-end;
    // }
    .message-entry.ng-enter, .message-entry.ng-leave {
      -webkit-transition: 0.5s linear all;
      transition: 0.5s linear all;
    }
    .message-entry.ng-enter, .message-entry.ng-leave.ng-leave-active {
      opacity: 0;
      height: 0px;
    }
    .message-entry.ng-leave, .message-entry.ng-enter.ng-enter-active {
      opacity: 1;
      height: 40px;
    }
  `],
  template: `
<div class="messages" ui-scroll-viewport layout="column" flex scroll-glue>

  <div ui-scroll="item in vm.datasource" buffer-size="20" adapter="adapter"
  layout="row" class="message-entry" ng-class="{outgoing: item.outgoing}">
  
    <md-icon md-font-library="material-icons">{{item.outgoing ? 'chat_bubble_outline' : 'comment'}}</md-icon>
    <div layout="column" class="message">
      <div class="header">
        <b ng-if="!item.outgoing">{{item.senderAccount}}&nbsp;&nbsp;&nbsp;&nbsp;</b>{{::item.dateFormatted}}
      </div>
      <div class="message-content">{{item.content}}</div>
    </div>
    
    <md-menu>
      <md-button aria-label="Message menu" class="md-icon-button menu-button" ng-click="vm.openMenu($mdMenu, $event)">
        <!--<md-icon md-menu-origin md-svg-icon="call:phone"></md-icon>-->
        ...
      </md-button>
      <md-menu-content width="4">
        <md-menu-item>
          <md-button ng-click="vm.removeMessage($event, item)">
            Remove
          </md-button>
        </md-menu-item>
      </md-menu-content>
    </md-menu>
    
  </div>
</div>
  `
})
@Inject('$scope','$q','$timeout','$document','heat','user','settings',
        'render','controlCharRender','storage', 'P2PMessaging')
class P2PMessagesViewerComponent {

  private publickey: string; // @input
  private containerId: string; // @input
  private store: Store;
  private dateFormat;
  // items: Array<p2p.MessageHistoryItem>;
  datasource: P2PMessagesDataSource;

  constructor(private $scope: angular.IScope,
              $q: angular.IQService,
              $timeout: angular.ITimeoutService,
              private $document: angular.IDocumentService,
              private heat: HeatService,
              private user: UserService,
              private settings: SettingsService,
              private render: RenderService,
              private controlCharRender: ControlCharRenderService,
              private storage: StorageService,
              private p2pMessaging: P2PMessaging) {

    if (this.publickey == this.user.publicKey) {
      throw Error("Same public key as logged in user");
    }

    this.dateFormat = this.settings.get(SettingsService.DATEFORMAT_DEFAULT);

    if (this.publickey != '0') {
      let room = this.p2pMessaging.getOneToOneRoom(this.publickey, true);
      if (room) {
        /* set seen time to future, so no need to update seen time on each new incoming message.
        The seen time will be updated to the real value on destroying this component*/
        this.p2pMessaging.updateSeenTime(room.name, Date.now() + 1000 * 60 * 60 * 24);

        this.datasource = new P2PMessagesDataSource(room.getMessageHistory(), item => this.processItem(item));
        room.onNewMessageHistoryItem = (item: p2p.MessageHistoryItem) => {
          this.datasource.first++;
          // @ts-ignore
          let adapter = $scope.adapter;
          if (adapter.isEOF()) {
            adapter.append([this.processItem(item)]);
          }
        };

        $scope.$on('$destroy', () => {
          this.p2pMessaging.updateSeenTime(room.name, Date.now());
          room.onNewMessageHistoryItem = null;
        });
      }
    }
  }

  openMenu($mdMenu, event) {
    $mdMenu.open(event);
  }

  removeMessage(event, item: p2p.MessageHistoryItem) {
    dialogs.confirm(
      "Remove message",
      `Do you want to remove the message ?`
    ).then(() => {
      this.datasource.remove(item);
      // @ts-ignore
      let adapter = this.$scope.adapter;
      adapter.applyUpdates(function (item2) {
        if (item2 == item) {
          return [];
        }
      });
    });
  }

  private processItem(item: p2p.MessageHistoryItem) {
    item['senderAccount'] = heat.crypto.getAccountIdFromPublicKey(item.fromPeer);
    item['outgoing'] = this.user.account == item['senderAccount'];
    item['dateFormatted'] = dateFormat(item.timestamp, this.dateFormat);
    return item;
  }

}

class P2PMessagesDataSource {
  data = [];
  first = 1;  //index pointed to the head of datasource's list of items. Increased on adding item.

  constructor(private messageHistory: p2p.MessageHistory,
              private processItem: (item: p2p.MessageHistoryItem) => {}) {
  }

  get(index: number, count: number, success) {
    let start = index;
    let end = Math.min(index + count - 1, this.first);
    if (start <= end) {
      let lastIndex = this.messageHistory.getItemCount() - 1;
      let items = this.messageHistory.getItemsScrollable(lastIndex + start - this.first, lastIndex + end - this.first + 1)
        .map(item => this.processItem(item));
      success(items);
    } else {
      success([]);
    }
  }

  remove(item: p2p.MessageHistoryItem) {
    this.messageHistory.remove(item.timestamp);
  }

}
