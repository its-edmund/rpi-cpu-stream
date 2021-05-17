const StreamrClient = require('streamr-client')
const fs = require('fs')

const client = new StreamrClient({
  auth: {
    privateKey: '2676f1a2ebbaef35196d9907f28f07dce55a12a9578a2c50077302192b84a155'
  }
})


var PiStats = function(){

  var memInfo = {};
  var currentCPUInfo = {total:0, active:0};
  var lastCPUInfo = {total:0, active:0};

  function getValFromLine(line){
    var match = line.match(/[0-9]+/gi);
    if(match !== null)
      return parseInt(match[0]);
    else
      return null;
  }

  var getMemoryInfo = function(cb){
    fs.readFile('/proc/meminfo', 'utf8', function(err, data){
      if(err){
        cb(err);
        return;
      }
      var lines = data.split('\n');
      memInfo.total = Math.floor(getValFromLine(lines[0]) / 1024);
      memInfo.free = Math.floor(getValFromLine(lines[1]) / 1024);
      memInfo.cached = Math.floor(getValFromLine(lines[3]) / 1024);
      memInfo.used = memInfo.total - memInfo.free;
      memInfo.percentUsed = Math.ceil(((memInfo.used - memInfo.cached) / memInfo.total) * 100);

      cb(null, memInfo);
    });
  };

  var calculateCPUPercentage = function(oldVals, newVals){
    var totalDiff = newVals.total - oldVals.total;
    var activeDiff = newVals.active - oldVals.active;
    return Math.ceil((activeDiff / totalDiff) * 100);
  };

  var getCPUInfo = function(cb){
    lastCPUInfo.active = currentCPUInfo.active;
    lastCPUInfo.idle = currentCPUInfo.idle;
    lastCPUInfo.total = currentCPUInfo.total;

    fs.readFile('/proc/stat', 'utf8', function(err, data){
      if(err){
        if(cb !== undefined)
          cb(err);
        return;
      }
      var lines = data.split('\n');
      var cpuTimes = lines[0].match(/[0-9]+/gi);
      currentCPUInfo.total = 0;
      // We'll count both idle and iowait as idle time
      currentCPUInfo.idle = parseInt(cpuTimes[3]) + parseInt(cpuTimes[4]);
      for (var i = 0; i < cpuTimes.length; i++){
        currentCPUInfo.total += parseInt(cpuTimes[i]);
      }
      currentCPUInfo.active = currentCPUInfo.total - currentCPUInfo.idle
      currentCPUInfo.percentUsed = calculateCPUPercentage(lastCPUInfo, currentCPUInfo);

      if(cb !== undefined)
        cb(null, currentCPUInfo);
    });
  };

  return{
    getMemoryInfo: getMemoryInfo,
    getCPUInfo: getCPUInfo,
    printMemoryInfo: function(){
      getMemoryInfo(function(err, data){
        console.log("total\tused\tfree\tcached");
        console.log( data.total + "\t" + data.used + "\t" + data.free + "\t" + data.cached );
        console.log("Memory Usage:\t" + data.percentUsed + "%");
      });
    },
    printCPUInfo: function(){
      getCPUInfo(function(err, data){
        console.log("Current CPU Usage: " + data.percentUsed + "%");

        client.publish('0x3c334501a3faa9344f8f42b65567157b8a388ea0/rpi-cpu', {
          cpuUsage: "Current CPU Usage: " + data.percentUsed + "%"
        })
      });
    }
  };
}();

PiStats.printMemoryInfo();
console.log("")
setInterval(PiStats.printCPUInfo, 1000);
