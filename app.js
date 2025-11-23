
(function(){
  angular.module('tetrisApp',[]).controller('MainController',function($scope){
    var vm=this;
    vm.theme='dark';
    vm.soundOn=true;
    vm.toggleTheme=function(){vm.theme = vm.theme==='dark'?'light':'dark'};
    vm.toggleSound=function(){vm.soundOn=!vm.soundOn; window.__tetrisSetSoundOn(vm.soundOn)};
  });
})();
