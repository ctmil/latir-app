/* global mainPage, deviceList, refreshButton */
/* global detailPage, resultDiv, messageInput, sendButton, disconnectButton */
/* global ble  */
/* jshint browser: true , devel: true*/
var inu = 0;
var osc;
var live = false;
var save = true;

var logOb;

'use strict';

function fail(e) {
	console.log("FileSystem Error");
	console.dir(e);
}

// ASCII only
function bytesToString(buffer) {
    return String.fromCharCode.apply(null, new Uint8Array(buffer));
}

// ASCII only
function stringToBytes(string) {
    var array = new Uint8Array(string.length);
    for (var i = 0, l = string.length; i < l; i++) {
        array[i] = string.charCodeAt(i);
    }
    return array.buffer;
}

// this is Nordic's UART service
/*var bluefruit = {
    serviceUUID: '0000ffe0-0000-1000-8000-00805f9b34fb',
    txCharacteristic: '0000ffe1-0000-1000-8000-00805f9b34fb', // transmit is from the phone's perspective
    rxCharacteristic: '0000ffe1-0000-1000-8000-00805f9b34fb'  // receive is from the phone's perspective
};*/
var bluefruit = {
    serviceUUID: 'ffe0',
    txCharacteristic: 'ffe1', // transmit is from the phone's perspective
    rxCharacteristic: 'ffe1'  // receive is from the phone's perspective
};

var app = {
    initialize: function() {
        this.bindEvents();
        detailPage.hidden = true;
    },
    bindEvents: function() {
        document.addEventListener('deviceready', this.onDeviceReady, false);
        refreshButton.addEventListener('touchstart', this.refreshDeviceList, false);
        sendButton.addEventListener('click', this.sendData, false);
        disconnectButton.addEventListener('touchstart', this.disconnect, false);
        deviceList.addEventListener('touchstart', this.connect, false); // assume not scrolling
    },
    onDeviceReady: function() {
        app.refreshDeviceList();

        osc = new OSC();

				app.logFile("test");

				live = false;
				save = true;

				document.getElementById("storage").style.background = "#008cdc";
		    document.getElementById("storage").style.color = "#eee";

		    document.getElementById("live").style.background = "#fff";
		    document.getElementById("live").style.color = "#444";
    },
		logFile: function(e) {
			if (cordova.platformId === 'android') {
				window.resolveLocalFileSystemURL(cordova.file.externalApplicationStorageDirectory, function(dir) {
					dir.getFile(e+"_log.txt", {create:true}, function(file) {
						logOb = file;
						//writeLog("Start");//Test
					});
				});
			}else{
				window.resolveLocalFileSystemURL(cordova.file.documentsDirectory, function(dir) {
					dir.getFile(e+"_log.txt", {create:true}, function(file) {
						logOb = file;
						//writeLog("Start");//Test
					});
				});
			}
    },
    refreshDeviceList: function() {
        deviceList.innerHTML = ''; // empties the list
        if (cordova.platformId === 'android') { // Android filtering is broken
            ble.scan([], 5, app.onDiscoverDevice, app.onError);
        } else {
            ble.scan([bluefruit.serviceUUID], 5, app.onDiscoverDevice, app.onError);
        }
    },
    onDiscoverDevice: function(device) {
        var listItem = document.createElement('li'),
            html = '<b>' + device.name + '</b><br/>' +
                'RSSI: ' + device.rssi + '&nbsp;|&nbsp;' +
                device.id;

        listItem.dataset.deviceId = device.id;
        listItem.innerHTML = html;
        deviceList.appendChild(listItem);
    },
    connect: function(e) {
        var deviceId = e.target.dataset.deviceId,
            onConnect = function(peripheral) {
                app.determineWriteType(peripheral);

                // subscribe for incoming data
                ble.startNotification(deviceId, bluefruit.serviceUUID, bluefruit.rxCharacteristic, app.onData, app.onError);
                sendButton.dataset.deviceId = deviceId;
                disconnectButton.dataset.deviceId = deviceId;
                resultDiv.innerHTML = "";
                app.showDetailPage();
            };

        ble.connect(deviceId, onConnect, app.onError);
    },
    determineWriteType: function(peripheral) {
        // Adafruit nRF8001 breakout uses WriteWithoutResponse for the TX characteristic
        // Newer Bluefruit devices use Write Request for the TX characteristic

        var characteristic = peripheral.characteristics.filter(function(element) {
            if (element.characteristic.toLowerCase() === bluefruit.txCharacteristic) {
                return element;
            }
        })[0];

        if (characteristic.properties.indexOf('WriteWithoutResponse') > -1) {
            app.writeWithoutResponse = true;
        } else {
            app.writeWithoutResponse = false;
        }

    },
    onData: function(data) { // data received from Arduino
        resultDiv.innerHTML = "Recibiendo: " + bytesToString(data) + "<br/>";
        resultDiv.scrollTop = resultDiv.scrollHeight;

        inu = parseInt( bytesToString(data) );

        if(live === true && save === false){
          var ipAd = document.getElementById('ips').value;
          var portAd = parseInt( document.getElementById('port').value);
          osc.send({
              remoteAddress: ipAd,
              remotePort: portAd,
              address: '/ecg',
              arguments: [inu]
          });
        }else if(save === true && live === false){
          writeLog( bytesToString(data) );
        }
    },
    sendData: function(event) { // send data to Arduino

        var success = function() {
            console.log("success");
            resultDiv.innerHTML = resultDiv.innerHTML + "Sent: " + messageInput.value + "<br/>";
            resultDiv.scrollTop = resultDiv.scrollHeight;
        };

        var failure = function() {
            alert("Failed writing data to the bluefruit le");
        };

        var data = stringToBytes(messageInput.value);
        var deviceId = event.target.dataset.deviceId;

        if (app.writeWithoutResponse) {
            ble.writeWithoutResponse(
                deviceId,
                bluefruit.serviceUUID,
                bluefruit.txCharacteristic,
                data, success, failure
            );
        } else {
            ble.write(
                deviceId,
                bluefruit.serviceUUID,
                bluefruit.txCharacteristic,
                data, success, failure
            );
        }

    },
    disconnect: function(event) {
        var deviceId = event.target.dataset.deviceId;
        ble.disconnect(deviceId, app.showMainPage, app.onError);
    },
    showMainPage: function() {
        mainPage.hidden = false;
        detailPage.hidden = true;
    },
    showDetailPage: function() {
        mainPage.hidden = true;
        detailPage.hidden = false;
    },
    onError: function(reason) {
        alert("ERROR: " + reason); // real apps should use notification.alert
    }
};

//STORAGE
function writeLog(str) {
	if(!logOb) return;
	var log = str;
	logOb.createWriter(function(fileWriter) {

		fileWriter.seek(fileWriter.length);

		var blob = new Blob([log], {type:'text/plain'});
		fileWriter.write(blob);
	}, fail);
}

//LISTENERs
document.getElementById("live").addEventListener("click", function(){
    live = true;
    save = false;

    document.getElementById("live").style.background = "#ff0926";
    document.getElementById("live").style.color = "#eee";

    document.getElementById("storage").style.background = "#fff";
    document.getElementById("storage").style.color = "#444";
});

document.getElementById("storage").addEventListener("click", function(){
    live = false;
    save = true;

    document.getElementById("storage").style.background = "#008cdc";
    document.getElementById("storage").style.color = "#eee";

    document.getElementById("live").style.background = "#fff";
    document.getElementById("live").style.color = "#444";
});

document.getElementById("log_name").addEventListener("click", function(){
	var name = document.getElementById('name').value;

	app.logFile(name);
});
