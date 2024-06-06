//////////////////////////////////////////////////////////////////////////////////////
///                                                                                ///
///  LOGGER SCRIPT FOR FM-DX-WEBSERVER (V1.1)                                      ///
///                                                                                ///
///  by Highpoint                                                                  ///
///                                                                                ///
///                                                         last update: 06.06.24  ///
//////////////////////////////////////////////////////////////////////////////////////

(() => {
    const loggerPlugin = (() => {

        // WebSocket configuration
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        const wsUrl = `${protocol}//${host}/text`;
        let displayedPiCodes = [];
        let logDataArray = [];
        const previousDataByFrequency = {};
        let currentFrequency = "";
        let previousFrequency = "";
        let autoScanSocket;
        const ServerName = document.title;
        const metaTag = document.querySelector('meta[property="og:description"]');
        const content = metaTag ? metaTag.getAttribute('content') : null;
        const ServerDescription = content ? content.replace('Server description: ', '') : null;
        let lastBlacklistFrequency = null;

        console.log('ServerName:', ServerName);
        console.log('ServerDescription:', ServerDescription);

        // Setup WebSocket connection
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

                // Ping server to keep the connection alive
                setInterval(() => {
                    autoScanSocket.send(JSON.stringify({ action: "ping" }));
                }, 250);
            }
        }

        // Handle incoming WebSocket messages
        function handleWebSocketMessage(event) {
            const eventData = JSON.parse(event.data);
            const frequency = eventData.freq;

            // Process data if frequency is not in the blacklist
            const txInfo = eventData.txInfo;

            let ps = eventData.ps;
            if ((eventData.ps_errors !== "0,0,0,0,0,0,0,1") && (eventData.ps_errors !== "0,0,0,0,0,0,0,0")) {
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

            if (eventData.pi.length > 1) {
                previousFrequency = currentFrequency; // Update previous frequency
                currentFrequency = frequency;
                displayExtractedData();
            }
        }

        // Create container for extracted data
        const extractedDataContainer = document.createElement("div");
        extractedDataContainer.id = "extracted-data-container";
        document.body.appendChild(extractedDataContainer);

        let isLoggerOn = false;

        // Ensure parent container exists
        let parentContainer = document.querySelector(".canvas-container.hide-phone");
        if (!parentContainer) {
            parentContainer = document.createElement("div");
            parentContainer.className = "canvas-container hide-phone";
            document.body.appendChild(parentContainer);
        }

        // Retrieve styles for further use
        const h2Style = window.getComputedStyle(document.querySelector('h2'));
        const borderColor = h2Style.color;

        // Create the logging canvas and append it to the parent container
        let loggingCanvas = document.createElement("div");
        loggingCanvas.id = "logging-canvas";
        loggingCanvas.style.height = "95%";
        loggingCanvas.style.width = "96.5%";
        loggingCanvas.style.marginTop = "0px";
        loggingCanvas.style.marginRight = "20px";
        loggingCanvas.style.marginLeft = "20px";
        loggingCanvas.style.display = 'none';
        loggingCanvas.style.border = "1px solid ";
        loggingCanvas.classList.add('color-4');
        loggingCanvas.style.whiteSpace = "nowrap"; // Prevent line wrapping
        parentContainer.appendChild(loggingCanvas);

        // Create a container for both titleDiv and dataCanvas
        const scrollContainer = document.createElement("div");
        scrollContainer.style.overflowX = "auto"; // Enable horizontal scroll bar
        scrollContainer.style.display = "block";
        scrollContainer.style.whiteSpace = "nowrap"; // Prevent line wrapping
        scrollContainer.style.width = "100%";
        scrollContainer.style.whiteSpace = "pre-wrap";
        loggingCanvas.appendChild(scrollContainer);

        // Create and configure title div
        const titleDiv = document.createElement("div");
        titleDiv.innerHTML = "<h2 style='margin-top: 0px; font-size: 16px;'><strong>DATE        TIME       FREQ    PI       PS         NAME                       CITY                   ITU POL    ERP  DIST   AZ</strong></h2>";
        titleDiv.style.padding = "10px";
        titleDiv.style.display = "block"; // Allow block display to stack elements vertically
        titleDiv.style.fontFamily = "Monospace"; // Customize font
        titleDiv.style.whiteSpace = "nowrap"; // Ensure no line wrapping
        titleDiv.style.overflowX = "auto"; // Enable horizontal scroll bar
        titleDiv.style.width = "max-content"; // Ensure content dictates width
        titleDiv.style.whiteSpace = "pre-wrap";
        scrollContainer.appendChild(titleDiv);

        // Create and configure data canvas
        let dataCanvas = document.createElement("div");
        dataCanvas.id = "output-canvas";
        dataCanvas.style.overflowX = "auto"; // Enable horizontal scroll bar
        dataCanvas.style.color = "white";
        dataCanvas.style.whiteSpace = "nowrap"; // Ensure no line wrapping
        dataCanvas.style.fontFamily = "Monospace";
        dataCanvas.style.position = "relative";
        dataCanvas.style.padding = "0";
        dataCanvas.style.whiteSpace = "nowrap";
        dataCanvas.style.display = "block"; // Allow block display to stack elements vertically
        dataCanvas.style.width = "max-content"; // Ensure content dictates width
        scrollContainer.appendChild(dataCanvas);

        // Function to set the height of the dataCanvas
        function setCanvasHeight() {
            const windowHeight = window.innerHeight; // Height of the browser window
            let canvasHeight;

            // Adjust the height based on different screen heights
            if (windowHeight <= 650) {
                canvasHeight = windowHeight * 0.075; // For screens smaller or equal to 650px
                dataCanvas.style.marginTop = "-10px";
            } else if (windowHeight <= 900) {
                canvasHeight = windowHeight * 0.08; // For screens smaller or equal to 900px
                dataCanvas.style.marginTop = "-10px";
            } else {
                canvasHeight = windowHeight * 0.118; // For larger screens
                dataCanvas.style.marginTop = "0px";
            }

            // Set the height of the dataCanvas
            dataCanvas.style.maxHeight = `${canvasHeight}px`;
        }

        // Call the function to set the initial height of the dataCanvas
        setCanvasHeight();

        // Add an event listener to adjust the height on window resize
        window.addEventListener('resize', setCanvasHeight);

        // Utility function to pad strings with spaces
        function padLeftWithSpaces(str, targetLength) {
            const spacesToAdd = targetLength - str.length;
            return spacesToAdd <= 0 ? str : " ".repeat(spacesToAdd) + str;
        }

        function padRightWithSpaces(text, desiredLength) {
            const spacesToAdd = Math.max(0, desiredLength - text.length);
            return text + " ".repeat(spacesToAdd);
        }

        // Utility function to truncate strings if they exceed a certain length
        function truncateString(str, maxLength) {
            return str.length > maxLength ? str.substring(0, maxLength) : str;
        }

        function displayExtractedData() {
            const loggingCanvas = document.getElementById("logging-canvas");

            if (loggingCanvas.style.display === "block") {
                let downloadButtonsContainer = document.querySelector(".download-buttons-container");

                if (!downloadButtonsContainer) {
                    downloadButtonsContainer = document.createElement("div");
                    downloadButtonsContainer.className = "download-buttons-container";
                    downloadButtonsContainer.style.display = "flex";
                    downloadButtonsContainer.style.position = "relative";
                    downloadButtonsContainer.style.marginLeft = "76.0%";
                    downloadButtonsContainer.style.marginTop = "-10px";

                    const blacklistButton = setupBlacklistButton();
                    if (blacklistButton instanceof Node) {
                        downloadButtonsContainer.appendChild(blacklistButton);
                    }

                    const DownloadButtonTXT = createDownloadButtonTXT();
                    if (DownloadButtonTXT instanceof Node) {
                        downloadButtonsContainer.appendChild(DownloadButtonTXT);
                    }

                    const DownloadButtonCSV = createDownloadButtonCSV();
                    if (DownloadButtonCSV instanceof Node) {
                        downloadButtonsContainer.appendChild(DownloadButtonCSV);
                    }

                    if (parentContainer instanceof Node) {
                        parentContainer.appendChild(downloadButtonsContainer);
                    }
                }
                loggingDataAdded = true;
            } else {
                const downloadButtonsContainer = document.querySelector(".download-buttons-container");
                if (downloadButtonsContainer && downloadButtonsContainer instanceof Node) {
                    downloadButtonsContainer.remove();
                }
                loggingDataAdded = false;
            }

            const now = new Date();
            const date = formatDate(now);
            const time = formatTime(now);
            let currentFrequencyWithSpaces = padLeftWithSpaces(currentFrequency, 7);

            const data = previousDataByFrequency[currentFrequency];
            if (data && data.picode.length > 1) {
                const station = truncateString(padRightWithSpaces(data.station, 25), 25);
                const city = truncateString(padRightWithSpaces(data.city, 21), 21);
                const itu = truncateString(padLeftWithSpaces(data.itu, 3), 3);
                const pol = truncateString(data.pol, 1);
                const erpTxt = truncateString(padLeftWithSpaces(String(data.erp), 6), 6);
                const distance = truncateString(padLeftWithSpaces(data.distance, 4), 4);
                const azimuth = truncateString(padLeftWithSpaces(data.azimuth, 3), 3);

                const picode = truncateString(padRightWithSpaces(data.picode, 7), 7);
                let ps = truncateString(padRightWithSpaces(data.ps.replace(/ /g, "_"), 9), 9);

                const outputText = pol ? `${date}  ${time}  ${currentFrequencyWithSpaces}  ${picode}  ${ps}  ${station}  ${city}  ${itu}  ${pol}  ${erpTxt}  ${distance}  ${azimuth}` : `${date}  ${time}  ${currentFrequencyWithSpaces}  ${picode}  ${ps}`;
                const outputArray = pol ? `${date} | ${time} | ${currentFrequencyWithSpaces} | ${picode} | ${ps} | ${station} | ${city} | ${itu} | ${pol} | ${erpTxt} | ${distance} | ${azimuth}` : `${date} | ${time} | ${currentFrequencyWithSpaces} | ${picode} | ${ps} |                           |                       |     |   |        |      | `;

                // Check if currentFrequency is in the blacklist
                function isInBlacklist(currentFrequency, blacklist) {
                    return blacklist.some(entry => entry.split(' ').includes(currentFrequency));
                }

                if (blacklist.length === 0 || !isInBlacklist(currentFrequency, blacklist)) {
                    if (currentFrequency !== previousFrequency) {
                        const newOutputDiv = document.createElement("div");
                        newOutputDiv.textContent = outputText;
                        newOutputDiv.style.whiteSpace = "pre-wrap";
                        newOutputDiv.style.fontSize = "16px";
                        newOutputDiv.style.marginBottom = "-1px";
                        newOutputDiv.style.padding = "0 10px";

                        if (dataCanvas instanceof Node) {
                            dataCanvas.appendChild(newOutputDiv);
                        }

                        logDataArray.push(outputArray);
                        dataCanvas.scrollTop = dataCanvas.scrollHeight - dataCanvas.clientHeight;
                    } else {
                        if (dataCanvas && dataCanvas.lastChild) {
                            const lastOutputDiv = dataCanvas.lastChild;
                            lastOutputDiv.textContent = outputText;
                            logDataArray[logDataArray.length - 1] = outputArray;
                        }
                    }
                } else {
                    if (currentFrequency !== lastBlacklistFrequency) {
                        console.log(`Frequency ${currentFrequency} is in the blacklist.`);
                        lastBlacklistFrequency = currentFrequency;
                    }
                }
            }
        }

        function coverTuneButtonsPanel(isCovered) {
            const tuneButtonsPanel = document.getElementById('tune-buttons');
            if (tuneButtonsPanel) {
                tuneButtonsPanel.style.backgroundColor = isCovered ? 'black' : '';
            }
        }

        // Toggle logger state and update UI accordingly
        function toggleLogger() {
            const LoggerButton = document.getElementById('Log-on-off');
            const downloadButtonsContainer = document.querySelector('.download-buttons-container');
            isLoggerOn = !isLoggerOn;

            if (isLoggerOn) {
                LoggerButton.classList.remove('bg-color-2');
                LoggerButton.classList.add('bg-color-4');
                coverTuneButtonsPanel(true); // Cover when logger is on
                displaySignalOutput();

                // Show the download buttons
                if (downloadButtonsContainer) {
                    downloadButtonsContainer.style.display = 'flex';
                } else {
                    createDownloadButtons(); // Function to create download buttons if not already created
                }
            } else {
                LoggerButton.classList.remove('bg-color-4');
                LoggerButton.classList.add('bg-color-2');
                coverTuneButtonsPanel(false); // Remove when logger is off
                displaySignalCanvas();

                // Hide the download buttons
                if (downloadButtonsContainer) {
                    downloadButtonsContainer.style.display = 'none';
                }
            }
        }

        // Create TXT download button
        function createDownloadButtonTXT() {
            const DownloadButtonTXT = document.createElement("button");
            DownloadButtonTXT.textContent = "TXT";
            DownloadButtonTXT.style.width = "50px";
            DownloadButtonTXT.style.height = "20px";
            DownloadButtonTXT.style.marginRight = "5px";
            DownloadButtonTXT.style.display = "flex";
            DownloadButtonTXT.style.alignItems = "center";
            DownloadButtonTXT.style.justifyContent = "center";
            DownloadButtonTXT.style.borderRadius = '0px 0px 0px 0px';
            DownloadButtonTXT.addEventListener("click", function() {
                downloadDataTXT();
            });

            return DownloadButtonTXT;
        }

        // Create CSV download button
        function createDownloadButtonCSV() {
            const DownloadButtonCSV = document.createElement("button");
            DownloadButtonCSV.textContent = "CSV";
            DownloadButtonCSV.style.width = "50px";
            DownloadButtonCSV.style.height = "20px";
            DownloadButtonCSV.style.display = "flex";
            DownloadButtonCSV.style.alignItems = "center";
            DownloadButtonCSV.style.justifyContent = "center";
            DownloadButtonCSV.style.borderRadius = '0px 0px 0px 0px';
            DownloadButtonCSV.addEventListener("click", function() {
                downloadDataCSV();
            });

            return DownloadButtonCSV;
        }

        // Display signal canvas
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

        // Display signal output
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

        // Format date as YYYY-MM-DD
        function formatDate(date) {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }

        // Format time as HH:MM:SS
        function formatTime(date) {
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            const seconds = String(date.getSeconds()).padStart(2, '0');
            return `${hours}:${minutes}:${seconds}`;
        }

        let blacklist = [];

        // Check and initialize blacklist
        function checkBlacklist() {
            const blacklistProtocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
            const port = window.location.port;
            const host = document.location.hostname;
            const blacklistUrl = `${blacklistProtocol}//${host}:${port}/logger/blacklist.txt`;

            fetch(blacklistUrl)
                .then(response => {
                    if (response.ok) {
                        return response.text();
                    } else {
                        throw new Error(`Error fetching blacklist: ${response.status} ${response.statusText}`);
                    }
                })
                .then(data => {
                    blacklist = data.split('\n').map(frequency => frequency.trim()).filter(Boolean);
                    console.log('Blacklist initialized:', blacklist);
                    setupBlacklistButton();
                })
                .catch(error => {
                    console.error('Error checking blacklist:', error.message);
                    blacklist = [];
                    setupBlacklistButton();
                });
        }

        // Setup blacklist button and state
        function setupBlacklistButton() {
            let blacklistButton = document.getElementById("blacklist-button");
            const blacklistState = getBlacklistStateFromCookie();

            if (!blacklistButton) {
                blacklistButton = document.createElement("button");
                blacklistButton.id = "blacklist-button";
                blacklistButton.style.width = "100px";
                blacklistButton.style.height = "20px";
                blacklistButton.style.marginLeft = "-145px";
                blacklistButton.style.marginRight = "10px";
                blacklistButton.style.marginTop = "0px";
                blacklistButton.style.display = "flex";
                blacklistButton.style.alignItems = "center";
                blacklistButton.style.justifyContent = "center";
                blacklistButton.style.borderRadius = '0px 0px 0px 0px';
                blacklistButton.style.fontWeight = "bold";
                blacklistButton.addEventListener("click", () => {
                    const newState = !getBlacklistStateFromCookie().state;
                    setBlacklistStateInCookie({ state: newState });
                    updateBlacklistState(newState);
                });

                updateBlacklistButton(blacklistButton, blacklistState.state);
            }

            return blacklistButton;
        }

        // Update blacklist button appearance based on state
        function updateBlacklistButton(button, state) {
            if (!button) {
                console.error('Blacklist button does not exist.');
                return;
            }
            if (!state) {
                button.textContent = "Blacklist OFF";
                button.classList.remove('bg-color-4');
                button.classList.add('bg-color-2');
            } else {
                button.textContent = "Blacklist ON";
                button.classList.remove('bg-color-2');
                button.classList.add('bg-color-4');
            }
        }

        // Retrieve blacklist state from cookies
        function getBlacklistStateFromCookie() {
            const cookieValue = document.cookie.split('; ').find(row => row.startsWith('blacklist='));
            return cookieValue ? JSON.parse(cookieValue.split('=')[1]) : { state: false };
        }

        // Set blacklist state in cookies
        function setBlacklistStateInCookie(state) {
            document.cookie = `blacklist=${JSON.stringify(state)}; path=/`;
        }

        // Update blacklist state and fetch blacklist if necessary
        function updateBlacklistState(state) {
            const blacklistProtocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
            const port = window.location.port;
            const host = document.location.hostname;
            const blacklistUrl = `${blacklistProtocol}//${host}:${port}/logger/blacklist.txt`;

            if (state) {
                // Blacklist is ON, fetch the blacklist file
                fetch(blacklistUrl, { method: 'HEAD' })
                    .then(response => {
                        if (response.ok) {
                            return fetch(blacklistUrl).then(res => res.text());
                        } else {
                            throw new Error(`Blacklist file not found: ${response.status} ${response.statusText}`);
                        }
                    })
                    .then(data => {
                        blacklist = data.split('\n').map(frequency => frequency.trim()).filter(Boolean);
                        console.log('Blacklist enabled:', blacklist);
                        updateBlacklistButton(document.getElementById("blacklist-button"), state);
                    })
                    .catch(error => {
                        console.error('Error checking blacklist:', error.message);
                        blacklist = [];
                        setBlacklistStateInCookie({ state: false });
                        updateBlacklistButton(document.getElementById("blacklist-button"), false);
                    });
            } else {
                // Blacklist is OFF, clear the blacklist
                blacklist = [];
                console.log('Blacklist disabled');
                updateBlacklistButton(document.getElementById("blacklist-button"), state);
            }
        }

        // Initial check of blacklist state
        function checkBlacklist() {
            const blacklistState = getBlacklistStateFromCookie().state;
            updateBlacklistState(blacklistState); // Ensure blacklist state is correctly set on page load
        }

        document.addEventListener("DOMContentLoaded", () => {
            setupBlacklistButton();
            checkBlacklist();
        });

        // Initialize the logger button
        function initializeLoggerButton() {
            setupWebSocket();

            const LoggerButton = document.createElement('button');
            LoggerButton.classList.add('hide-phone');
            LoggerButton.id = 'Log-on-off';
            LoggerButton.setAttribute('aria-label', 'Scan');
            LoggerButton.setAttribute('data-tooltip', 'Auto Scan on/off');
            LoggerButton.style.borderRadius = '0px 0px 0px 0px';
            LoggerButton.style.width = '100px';
            LoggerButton.style.position = 'relative';
            LoggerButton.style.marginTop = '15px';
            LoggerButton.style.right = '0px';
            LoggerButton.innerHTML = '<strong>RDS-LOGGER</strong>';
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

            // Ensure download buttons are initially hidden
            const downloadButtonsContainer = document.querySelector('.download-buttons-container');
            if (downloadButtonsContainer) {
                downloadButtonsContainer.style.display = 'none';
            }
        }

        // Initialize on window load
        window.onload = function() {
            initializeLoggerButton();
            checkBlacklist();
        };

        // Download data as TXT
        function downloadDataTXT() {
            const now = new Date();
            const currentDate = formatDate(now);
            const currentTime = formatTime(now);

            const filename = `RDS-LOGGER_${currentDate}_${currentTime}.txt`;
            let allData = `${ServerName}\n${ServerDescription}\nRDS-LOGGER ${currentDate} ${currentTime}\n\n` +
                `DATE       | TIME      | FREQ   | PI      | PS        | NAME                      | CITY                  | ITU | P |    ERP | DIST |  AZ\n` +
                `------------------------------------------------------------------------------------------------------------------------------------------\n`;

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

        // Download data as CSV
        function downloadDataCSV() {
            const now = new Date();
            const currentDate = formatDate(now);
            const currentTime = formatTime(now);

            const filename = `RDS-LOGGER_${currentDate}_${currentTime}.csv`;
            let allData = `${ServerName}\n${ServerDescription}\nRDS-LOGGER ${currentDate} ${currentTime}\n\ndate;time;freq;pi;ps;name;city;itu;pol;erp;dist;az\n`;

            logDataArray.forEach(line => {
                const modifiedLine = line.replaceAll(/\s*\|\s*/g, ";");
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

    })();
})();

