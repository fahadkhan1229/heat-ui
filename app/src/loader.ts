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
module heat {

  export var isTestnet = window.localStorage.getItem('testnet')=='true';
  export var isBetanet = window.localStorage.getItem('betanet')=='true';

  export var $inject: angular.auto.IInjectorService;

  /* Allows us to fully reload all components that make up the app while leaving
     intact all initialized services, call this method after switching to the
     desired location path. */
  export function fullApplicationScopeReload() {}

  export class Loader {

    static app: angular.IModule;
    private static config_fn = [];
    private static run_fn = [];
    private static controller_fn = [];
    private static factory_fn = [];
    private static directive_fn = [];

    constructor() {
      Loader.controller('AppController', ['$router','user','$location','$scope','$rootScope',
      function ($router, user: UserService, $location: angular.ILocationService, $scope: angular.IScope, $rootScope: angular.IScope) {

        heat.$inject = angular.element(document).injector();

        $router.config({ path: '/', redirectTo: '/login' });

        function isUnlocked() {
          if (!user.unlocked) {
            if (!/\/p2pmessagingprobe.*/.test($location.path()) &&
                !/\/trader.*/.test($location.path()) &&
                !/\/explorer.*/.test($location.path()) &&
                !/\/explore-account.*/.test($location.path())) {
              if (!/\/login\/\w+/.test($location.path())) {
                $location.path('login');
              }
            }
          }
          // Live agent show-hide contact button.
          // var el = angular.element(document.documentElement);
          // if (/\/claim/.test($location.path()) || /\/claim2\/\w+/.test($location.path())) {
          //   if (el.hasClass('hide-live-agent')) {
          //     el.removeClass('hide-live-agent');
          //   }
          // }
          // else {
          //   if (!el.hasClass('hide-live-agent')) {
          //     el.addClass('hide-live-agent');
          //   }
          // }
        }

        isUnlocked();

        $scope['userUnlocked'] = user.unlocked;
        $rootScope['isTestnet'] = heat.isTestnet;

        $rootScope.$on('$locationChangeSuccess', isUnlocked);

        user.on(UserService.EVENT_UNLOCKED, () => {
          $scope.$evalAsync(() => { $scope['userUnlocked'] = true })
        });

        user.on(UserService.EVENT_LOCKED, () => {
          $scope.$evalAsync(() => { $scope['userUnlocked'] = false })
        });

        /* Enable full application scope reload */
        $scope['showApp'] = true
        heat.fullApplicationScopeReload = function () {
          $scope.$evalAsync(() => {
            $scope['showApp'] = false
            setTimeout(function () {
              $scope.$evalAsync(() => {
                $scope['showApp'] = true
              })
            }, 250)
          })
        }

      }]);

      this.init('heatApp', [
        'ngNewRouter',
        'ngAnimate',
        'ngMaterial',
        'ngMessages',
        'noCAPTCHA',
        'ngSanitize',
        'duScroll',
        'dc.inputAddOn',
        'jsonFormatter',
        'luegg.directives',
        'angular-popover',
        'ui.scroll', 'ui.scroll.grid'
      ]);
    }

    init(appName: string, externalModules: string[]) {
      var app = Loader.app = angular.module(appName, externalModules);

      angular.forEach(Loader.config_fn, (v) => { app.config(v) });
      angular.forEach(Loader.factory_fn, (v) => { app.factory(v.name, v.factory) });
      angular.forEach(Loader.directive_fn, (v) => { app.directive(v.name, v.factory) });
      angular.forEach(Loader.controller_fn, (v) => { app.controller(v.name, v.factory) });
      angular.forEach(Loader.run_fn, (v) => { app.run(v) });

      Loader.config_fn = null;
      Loader.run_fn = null;
      Loader.controller_fn = null;
      Loader.factory_fn = null;

      angular.bootstrap(document, [appName]);
    }

    static config(array: any) { Loader.config_fn.push(array) }
    static run(array: any) { Loader.run_fn.push(array) }
    static controller(name:string, factory: any) {
      if (Loader.controller_fn)
        Loader.controller_fn.push({name:name, factory:factory})
      else
        Loader.app.controller(name, factory);
    }
    static factory(name:string, factory: any) {
      if (Loader.factory_fn)
        Loader.factory_fn.push({name:name, factory:factory})
      else
        Loader.app.factory(name, factory);
    }
    static directive(name:string, factory: any) {
      if (Loader.directive_fn)
        Loader.directive_fn.push({name:name, factory:factory})
      else
        Loader.app.directive(name, factory);
    }
  }
}
