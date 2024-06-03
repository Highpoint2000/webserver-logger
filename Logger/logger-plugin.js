//////////////////////////////////////////////////////////////////////////////////////
///                                                                                ///
///  LOGGER SCRIPT FOR FM-DX-WEBSERVER (V1.0)                                      ///
///                                                                                /// 
///  by Highpoint                                                                  ///
///																				   ///
///                                                         last update: 03.06.24  ///
//////////////////////////////////////////////////////////////////////////////////////

(() => {
    const loggerPlugin = (() => {

        let displayedPiCodes = [];
        let logDataArray = [];
        const previousDataByFrequency = {};
        let currentFrequency = "";
        let previousFrequency = "";
        let autoScanSocket;
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        const wsUrl = `${protocol}//${host}/text`;

        function setupWebSocket() {
            if (!autoScanSocket || autoScanSocket.readyState === WebSocket.CLOSED) {
                autoScanSocket = new WebSocket(wsUrl);

                autoScanSocket.addEventListener("open", () => {
                    console.log("WebSocket connected.");
                });

                autoScanSocket.addEventListener("message", handleWebSocketMessage);

                autoScanSocket.addEventListener("error", (error) => {
                    console.error("WebSocket error:", error);
                });

                setInterval(() => {
                    autoScanSocket.send(JSON.stringify({ action: "ping" }));
                }, 250);
            }
        }

        function handleWebSocketMessage(event) {
            const eventData = JSON.parse(event.data);
            const frequency = eventData.freq;
            const txInfo = eventData.txInfo;

            let ps = eventData.ps;
            if (eventData.ps_errors !== "0,0,0,0,0,0,0,0") {
                ps += "?";
            }

            previousDataByFrequency[frequency] = {
                picode: eventData.pi,
                ps: ps,
                station: txInfo ? txInfo.station : "",
                pol: txInfo ? txInfo.pol : "",
                erp: txInfo ? txInfo.erp : "",
                city: txInfo ? txInfo.city : "",
                itu: txInfo ? txInfo.itu : "",
                distance: txInfo ? txInfo.distance : "",
                azimuth: txInfo ? txInfo.azimuth : ""
            };

            if (currentFrequency !== frequency) {
                previousFrequency = currentFrequency;
                currentFrequency = frequency;
                displayExtractedData();
            }
        }

        const extractedDataContainer = document.createElement("div");
        extractedDataContainer.id = "extracted-data-container";
        document.body.appendChild(extractedDataContainer);

        let loggingDataAdded = false;

        function displayExtractedData() {
            let parentContainer = document.querySelector(".canvas-container.hide-phone");
            if (!parentContainer) {
                parentContainer = document.createElement("div");
                parentContainer.className = "canvas-container hide-phone";
                document.body.appendChild(parentContainer);
            }

            let loggingCanvas = document.getElementById("logging-canvas");
            if (!loggingCanvas) {
                loggingCanvas = document.createElement("div");
                loggingCanvas.id = "logging-canvas";
                loggingCanvas.style.height = "175px";
                loggingCanvas.style.width = "96.5%";
                loggingCanvas.style.margin = "0px auto 0";
                parentContainer.appendChild(loggingCanvas);
                loggingCanvas.style.display = 'none';
            }

            if (!loggingDataAdded) {
                const loggingDataDiv = document.createElement("div");
                loggingDataDiv.innerHTML = "<h2 style='margin-top: 0px; font-size: 16px;'><strong>date | time | freq | pi | ps | name | pol | erp | city | itu | dist | az</strong></h2>";
                loggingDataDiv.style.padding = "10px";
                loggingDataDiv.style.display = "flex";
                loggingDataDiv.style.alignItems = "center";
                loggingCanvas.appendChild(loggingDataDiv);

                const downloadButtonsContainer = document.createElement("div");
                downloadButtonsContainer.style.display = "flex";
                downloadButtonsContainer.style.marginLeft = "auto";

                const DownloadButtonTXT = createDownloadButtonTXT();
                downloadButtonsContainer.appendChild(DownloadButtonTXT);

                const DownloadButtonCSV = createDownloadButtonCSV();
                downloadButtonsContainer.appendChild(DownloadButtonCSV);

                loggingDataDiv.appendChild(downloadButtonsContainer);
                loggingDataAdded = true;
            }

            let outputCanvas = document.getElementById("output-canvas");
            if (!outputCanvas) {
                outputCanvas = document.createElement("div");
                outputCanvas.id = "output-canvas";
                outputCanvas.style.overflow = "auto";
                outputCanvas.style.height = "117px";
                loggingCanvas.appendChild(outputCanvas);
            }

            if (previousFrequency && previousDataByFrequency[previousFrequency] && previousDataByFrequency[previousFrequency].picode.length > 1) {
                const now = new Date();
                const year = now.getFullYear();
                const month = String(now.getMonth() + 1).padStart(2, '0');
                const day = String(now.getDate()).padStart(2, '0');
                const hours = String(now.getHours()).padStart(2, '0');
                const minutes = String(now.getMinutes()).padStart(2, '0');
                const seconds = String(now.getSeconds()).padStart(2, '0');
                const datetime = `${year}-${month}-${day} | ${hours}:${minutes}:${seconds}`;

                const data = previousDataByFrequency[previousFrequency];
                const station = data.station;
                const pol = data.pol;
                const erp = data.erp;
                const city = data.city;
                const itu = data.itu;
                const distance = data.distance;
                const azimuth = data.azimuth;

                const picode = data.picode;
                const ps = data.ps.replace(/ /g, "_");
                const outputText = station ? `${datetime} | ${previousFrequency} | ${picode} | ${ps} | ${station} | ${pol} | ${erp} | ${city} | ${itu} | ${distance} | ${azimuth}` : `${datetime} | ${previousFrequency} | ${picode} | ${ps}`;

                logDataArray.push(outputText);

                const outputDiv = document.createElement("div");
                outputDiv.textContent = outputText;
                outputDiv.style.fontSize = "16px";
                outputDiv.style.marginBottom = "-1px";
                outputDiv.style.padding = "0 10px";

                outputCanvas.appendChild(outputDiv);

                // Scroll to the bottom to show the last 5 entries
                outputCanvas.scrollTop = outputCanvas.scrollHeight - outputCanvas.clientHeight;
            }

            outputCanvas.style.position = "relative";
            outputCanvas.style.top = "0px";
            outputCanvas.style.left = "0px";
            outputCanvas.style.padding = "0";
            loggingCanvas.style.padding = "0px";
            var h2Style = window.getComputedStyle(document.querySelector('h2'));
            var borderColor = h2Style.color;
            loggingCanvas.style.border = "1px solid " + borderColor;
        }

        function createDownloadButtonTXT() {
            const DownloadButtonTXT = document.createElement("button");
            DownloadButtonTXT.textContent = "TXT";
            DownloadButtonTXT.style.width = "50px";
            DownloadButtonTXT.style.height = "20px";
            DownloadButtonTXT.style.marginRight = "5px";
            DownloadButtonTXT.style.display = "flex";
            DownloadButtonTXT.style.alignItems = "center";
            DownloadButtonTXT.style.justifyContent = "center";
            DownloadButtonTXT.addEventListener("click", function() {
                downloadDataTXT();
            });

            return DownloadButtonTXT;
        }

        function createDownloadButtonCSV() {
            const DownloadButtonCSV = document.createElement("button");
            DownloadButtonCSV.textContent = "CSV";
            DownloadButtonCSV.style.width = "50px";
            DownloadButtonCSV.style.height = "20px";
            DownloadButtonCSV.style.display = "flex";
            DownloadButtonCSV.style.alignItems = "center";
            DownloadButtonCSV.style.justifyContent = "center";
            DownloadButtonCSV.addEventListener("click", function() {
                downloadDataCSV();
            });

            return DownloadButtonCSV;
        }

        function downloadDataTXT() {
            const filename = "logging_data.txt";
            let allData = "DATA LOGGER date | time | freq | pi | ps | name | pol | erp | city | itu | dist | az\n";

            logDataArray.forEach(line => {
                allData += line + '\n';
            });

            const blob = new Blob([allData], { type: "text/plain" });

            if (window.navigator.msSaveOrOpenBlob) {
                window.navigator.msSaveOrOpenBlob(blob, filename);
            } else {
                const link = document.createElement("a");
                link.href = window.URL.createObjectURL(blob);
                link.download = filename;
                link.click();
                window.URL.revokeObjectURL(link.href);
            }
        }

        function downloadDataCSV() {
            const filename = "logging_data.csv";
            let allData = "DATA LOGGER\ndate;time;freq;pi;ps;name;pol;erp;city;itu;dist;az\n";

            logDataArray.forEach(line => {
                const modifiedLine = line.replaceAll(" | ", ";");
                allData += modifiedLine + '\n';
            });

            const blob = new Blob([allData], { type: "text/plain" });

            if (window.navigator.msSaveOrOpenBlob) {
                window.navigator.msSaveOrOpenBlob(blob, filename);
            } else {
                const link = document.createElement("a");
                link.href = window.URL.createObjectURL(blob);
                link.download = filename;
                link.click();
                window.URL.revokeObjectURL(link.href);
            }
        }

        function initializeLoggerButton() {
            setupWebSocket();

            const LoggerButton = document.createElement('button');
            LoggerButton.classList.add('hide-phone');
            LoggerButton.id = 'Log-on-off';
            LoggerButton.setAttribute('aria-label', 'Scan');
            LoggerButton.setAttribute('data-tooltip', 'Auto Scan on/off');
            LoggerButton.style.borderRadius = '0px 0px 0px 0px';
            LoggerButton.style.width = '100px';
            LoggerButton.style.margin = '0 1px';
            LoggerButton.style.position = 'relative';
            LoggerButton.style.top = '0px';
            LoggerButton.style.right = '0px';
            LoggerButton.innerHTML = '<strong>DATA LOGGER</strong>';
            LoggerButton.classList.add('bg-color-3');

            const wrapperElement = document.querySelector('.tuner-info');
            if (wrapperElement) {
                const buttonWrapper = document.createElement('div');
                buttonWrapper.classList.add('button-wrapper');
                buttonWrapper.appendChild(LoggerButton);
                wrapperElement.appendChild(buttonWrapper);

                // Add empty line after the button
                const emptyLine = document.createElement('br');
                wrapperElement.appendChild(emptyLine);
            }

            LoggerButton.addEventListener('click', toggleLogger);
            displaySignalCanvas();

            const loggingCanvas = document.getElementById('logging-canvas');
            if (loggingCanvas) {
                loggingCanvas.style.display = 'block';
            }
        }

        let isLoggerOn = false;

        function coverTuneButtonsPanel(isCovered) {
            const tuneButtonsPanel = document.getElementById('tune-buttons');
            if (tuneButtonsPanel) {
                if (isCovered) {
                    tuneButtonsPanel.style.backgroundColor = 'black';
                } else {
                    tuneButtonsPanel.style.backgroundColor = '';
                }
            }
        }

        // In the toggleLogger function
        function toggleLogger() {
            const LoggerButton = document.getElementById('Log-on-off');
            isLoggerOn = !isLoggerOn;

            if (isLoggerOn) {
                LoggerButton.classList.remove('bg-color-3');
                LoggerButton.classList.add('bg-color-4');
                coverTuneButtonsPanel(true); // Cover when logger is on
                displaySignalOutput();
            } else {
                LoggerButton.classList.remove('bg-color-4');
                LoggerButton.classList.add('bg-color-3');
                coverTuneButtonsPanel(false); // Remove when logger is off
                displaySignalCanvas();
            }
        }


        function displaySignalCanvas() {
            const loggingCanvas = document.getElementById('logging-canvas');
            if (loggingCanvas) {
                loggingCanvas.style.display = 'none';
            }
            const signalCanvas = document.getElementById('signal-canvas');
            if (signalCanvas) {
                signalCanvas.style.display = 'block';
            }
        }

        function displaySignalOutput() {
            const loggingCanvas = document.getElementById('logging-canvas');
            if (loggingCanvas) {
                loggingCanvas.style.display = 'block';
            }
            const signalCanvas = document.getElementById('signal-canvas');
            if (signalCanvas) {
                signalCanvas.style.display = 'none';
            }
        }

        window.onload = function() {
            initializeLoggerButton();
        };

    })();
})();
