//////////////////////////////////////////////////////////////////////////////////////
///                                                                                ///
///  LOGGER SCRIPT FOR FM-DX-WEBSERVER (V1.2)                                      ///
///                                                                                ///
///  by Highpoint                                                                  ///
///                                                                                ///
///                                                         last update: 07.06.24  ///
//////////////////////////////////////////////////////////////////////////////////////

const FMLIST_OM_ID = ''; //To be able to use the logbook function - please enter your OM ID here, for example: FMLIST_OM_ID = '1234'

/////////////////////////////////////////////////////////////////////////////////////

(() => {
    const loggerPlugin = (() => {

        // User agent detection for the operating system
        let OperatingSystem = "other";
        const userAgent = navigator.userAgent.toLowerCase();

        if (userAgent.includes("linux") || userAgent.includes("apple")) {
            OperatingSystem = "linux";
        }

        console.log('Operating System:', OperatingSystem);

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

        const LAT = localStorage.getItem('qthLatitude');
        const LON = localStorage.getItem('qthLongitude');

        // Logging the coordinates to the console
        console.log('Latitude:', LAT);
        console.log('Longitude:', LON);

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

        if (OperatingSystem == 'linux') {
            titleDiv.innerHTML = "<h2 style='margin-top: 0px; font-size: 16px;'><strong>DATE        TIME       FREQ    PI       PS         NAME                     CITY                 ITU POL    ERP  DIST   AZ</strong></h2>";
        } else {
            titleDiv.innerHTML = "<h2 style='margin-top: 0px; font-size: 16px;'><strong>DATE        TIME       FREQ    PI       PS         NAME                       CITY                   ITU POL    ERP  DIST   AZ</strong></h2>";
        }
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

        let downloadButtonsContainer = document.querySelector(".download-buttons-container");

        if (!downloadButtonsContainer) {
            downloadButtonsContainer = document.createElement("div");
            downloadButtonsContainer.className = "download-buttons-container";
            downloadButtonsContainer.style.display = "none";
            downloadButtonsContainer.style.position = "relative";
            downloadButtonsContainer.style.marginLeft = "76.0%";
            downloadButtonsContainer.style.marginTop = "-1px";

            const FMLISTButton = createFMLISTButton();
            if (FMLISTButton instanceof Node) {
                downloadButtonsContainer.appendChild(FMLISTButton);
            }
			
            const FMDXPLButton = createFMDXPLButton();
            if (FMDXPLButton instanceof Node) {
                downloadButtonsContainer.appendChild(FMDXPLButton);
            }

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

            const DownloadButtonHTML = createDownloadButtonHTML();
            if (DownloadButtonHTML instanceof Node) {
                downloadButtonsContainer.appendChild(DownloadButtonHTML);
            }

            if (parentContainer instanceof Node) {
                parentContainer.appendChild(downloadButtonsContainer);
            }
        }

        let idAll = '';
        let id = '';
        let loopCounter = 0; // Initialize counter
		
        // Variable to track the window state
        let FMDXPLALLWindow = null;
        let isOpenFMDXPLALL = false;

        // Function to create the FMDXPLALL button and link it to the overlay
        function createFMDXPLALLButton() {
            // Create the button
            const FMDXPLALLButton = document.createElement("button");
            FMDXPLALLButton.textContent = "FMDXPLALL";
            FMDXPLALLButton.style.width = "80px";
            FMDXPLALLButton.style.height = "20px";
            FMDXPLALLButton.style.marginRight = "-145%";
            FMDXPLALLButton.style.marginLeft = "-50px";
            FMDXPLALLButton.style.display = "flex";
            FMDXPLALLButton.style.alignItems = "center";
            FMDXPLALLButton.style.justifyContent = "center";
            FMDXPLALLButton.style.borderRadius = '0px';

            // Event listener for button click
            FMDXPLALLButton.addEventListener("click", function () {
                if (id) {
                    // Check if the popup window is already open
                    if (isOpenFMDXPLALL && FMDXPLALLWindow && !FMDXPLALLWindow.closed) {
                        // Close if already open
                        FMDXPLALLWindow.close();
                        isOpenFMDXPLALL = false;
                    } else {
                        // Open if not already open
                        openFMDXPLALLPage();
                        isOpenFMDXPLALL = true;
                    }
                } else {
                    alert("Station not yet fully identified!");
                }
            });

            return FMDXPLALLButton;
        }



        // Variable to track the window state
        let fmdxplWindow = null;
        let isOpenfmdxpl = false;

        // Function to create the FMDXPL button and link it to the overlay
        function createFMDXPLButton() {
            // Create the button
            const FMDXPLButton = document.createElement("button");
            FMDXPLButton.textContent = "FMDXPL";
            FMDXPLButton.style.width = "80px";
            FMDXPLButton.style.height = "20px";
            FMDXPLButton.style.marginRight = "-145%";
            FMDXPLButton.style.marginLeft = "-50px";
            FMDXPLButton.style.display = "flex";
            FMDXPLButton.style.alignItems = "center";
            FMDXPLButton.style.justifyContent = "center";
            FMDXPLButton.style.borderRadius = '0px';

            // Event listener for button click
            FMDXPLButton.addEventListener("click", function () {
                if (id) {
                    // Check if the popup window is already open
                    if (isOpenfmdxpl && fmdxplWindow && !fmdxplWindow.closed) {
                        // Close if already open
                        fmdxplWindow.close();
                        isOpenfmdxpl = false;
                    } else {
                        // Open if not already open
                        openFMDXPLPage();
                        isOpenfmdxpl = true;
                    }
                } else {
                    alert("Station not yet fully identified!");
                }
            });

            return FMDXPLButton;
        }

        // Function to open the FMDXPL link in a popup window
        function openFMDXPLPage() {
            // URL for the website
            const url = `https://maps.fmdx.pl/#qth=${LAT},${LON}&id=${id}&findId=*`;

            // Open the link in a popup window
            fmdxplWindow = window.open(url, "_blank", "width=600,height=400"); // Adjust the window size as needed
        }

        // Variable to track the window state
        let FMLISTWindow = null;
        let isOpenFMLIST = false;

        // Function to create the FMLIST button and link it to the overlay
        function createFMLISTButton() {
            // Create the button
            const FMLISTButton = document.createElement("button");
            FMLISTButton.textContent = "FMLIST";
            FMLISTButton.style.width = "80px";
            FMLISTButton.style.height = "20px";
            FMLISTButton.style.marginRight = "-125px";
            FMLISTButton.style.marginLeft = "-40px";
            FMLISTButton.style.display = "flex";
            FMLISTButton.style.alignItems = "center";
            FMLISTButton.style.justifyContent = "center";
            FMLISTButton.style.borderRadius = '0px';

            if (FMLIST_OM_ID) {
                FMLISTButton.classList.add('bg-color-4');
            } else {
                FMLISTButton.classList.add('bg-color-2');
                FMLISTButton.classList.add('inactive'); // Add class for inactivity
                FMLISTButton.disabled = true; // Disable button if FMLIST_OM_ID has no value
            }

            // Event listener for button click
            FMLISTButton.addEventListener("click", function () {
                if (FMLIST_OM_ID) {
                    if (id) {
                        // Check if the popup window is already open
                        if (isOpenFMLIST && FMLISTWindow && !FMLISTWindow.closed) {
                            // Close if already open
                            FMLISTWindow.close();
                            isOpenFMLIST = false;
                        } else {
                            // Open if not already open
                            const data = previousDataByFrequency[currentFrequency];
                            openFMLISTPage(data.distance, data.azimuth, data.itu);
                            isOpenFMLIST = true;
                        }
                    } else {
                        alert("Station not yet fully identified!");
                    }
                }
            });

            return FMLISTButton;
        }

        // Function to open the FMLIST link in a popup window
        function openFMLISTPage(distance, azimuth, itu) {
            // URL for the website
            const url = `https://www.fmlist.org/fi_inslog.php?lfd=${id}&qrb=${distance}&qtf=${azimuth}&country=${itu}&omid=${FMLIST_OM_ID}`;

            // Open the link in a popup window
            FMLISTWindow = window.open(url, "_blank", "width=800,height=820"); // Adjust the window size as needed
        }

        // Add CSS to remove hover effects for inactive buttons
        const style = document.createElement('style');
        style.innerHTML = `
            .inactive {
                pointer-events: none;
                cursor: not-allowed;
            }
            .inactive:hover {
                background-color: inherit; /* Remove hover effects */
            }
        `;
        document.head.appendChild(style);

        // Display extracted data
        async function displayExtractedData() {
            const now = new Date();
            const date = formatDate(now);
            const time = formatTime(now);
            let currentFrequencyWithSpaces = padLeftWithSpaces(currentFrequency, 7);

            const data = previousDataByFrequency[currentFrequency];
            if (data && data.picode.length > 1) {
                let station, city;
                if (OperatingSystem == 'linux') {
                    station = truncateString(padRightWithSpaces(data.station, 23), 23);
                    city = truncateString(padRightWithSpaces(data.city, 19), 19);
                } else {
                    station = truncateString(padRightWithSpaces(data.station, 25), 25);
                    city = truncateString(padRightWithSpaces(data.city, 21), 21);
                }
                const itu = truncateString(padLeftWithSpaces(data.itu, 3), 3);
                const pol = truncateString(data.pol, 1);
                const erpTxt = truncateString(padLeftWithSpaces(String(data.erp), 6), 6);
                const distance = truncateString(padLeftWithSpaces(data.distance, 4), 4);
                const azimuth = truncateString(padLeftWithSpaces(data.azimuth, 3), 3);

                const picode = truncateString(padRightWithSpaces(data.picode, 7), 7);
                let ps = truncateString(padRightWithSpaces(data.ps.replace(/ /g, "_"), 9), 9);

                const outputText = pol ? `${date}  ${time}  ${currentFrequencyWithSpaces}  ${picode}  ${ps}  ${station}  ${city}  ${itu}  ${pol}  ${erpTxt}  ${distance}  ${azimuth}` : `${date}  ${time}  ${currentFrequencyWithSpaces}  ${picode}  ${ps}`;
                let outputArray;
                if (OperatingSystem == 'linux') {
                    outputArray = pol ? `${date} | ${time} | ${currentFrequencyWithSpaces} | ${picode} | ${ps} | ${station} | ${city} | ${itu} | ${pol} | ${erpTxt} | ${distance} | ${azimuth}` : `${date} | ${time} | ${currentFrequencyWithSpaces} | ${picode} | ${ps} |                         |                     |     |   |        |      |    `;
                } else {
                    outputArray = pol ? `${date} | ${time} | ${currentFrequencyWithSpaces} | ${picode} | ${ps} | ${station} | ${city} | ${itu} | ${pol} | ${erpTxt} | ${distance} | ${azimuth}` : `${date} | ${time} | ${currentFrequencyWithSpaces} | ${picode} | ${ps} |                           |                       |     |   |        |      |    `;
                }

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
                        outputArray += ` | ${id}`;
                        logDataArray.push(outputArray);
                        dataCanvas.scrollTop = dataCanvas.scrollHeight - dataCanvas.clientHeight;
                        loopCounter = 0; // Reset counter after processing a new frequency
                    } else {
                        if (dataCanvas && dataCanvas.lastChild) {
                            const lastOutputDiv = dataCanvas.lastChild;
                            lastOutputDiv.textContent = outputText;
                            outputArray += ` | ${id}`;
                            logDataArray[logDataArray.length - 1] = outputArray;
                        }
                    }

                    if (pol !== '' && loopCounter === 0) {
                        let picodeWithout = picode.replace(/\?/g, '').replace(/\s/g, '');
                        let ituWithout = itu.replace(/\s/g, '');
                        loopCounter++; // Increment counter after loop
                        if (loopCounter === 1) {
                            id = await getidValue(currentFrequency, picodeWithout, ituWithout);
                            if (id) {
                                idAll += idAll ? `,${id}` : id;
                            }
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

        // Cover the tune buttons panel
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
            DownloadButtonTXT.addEventListener("click", function () {
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
            DownloadButtonCSV.addEventListener("click", function () {
                downloadDataCSV();
            });

            return DownloadButtonCSV;
        }

        // Create HTML download button
        function createDownloadButtonHTML() {
            const DownloadButtonHTML = document.createElement("button");
            DownloadButtonHTML.textContent = "HTML";
            DownloadButtonHTML.style.width = "50px";
            DownloadButtonHTML.style.height = "20px";
            DownloadButtonHTML.style.marginLeft = "5px";
            DownloadButtonHTML.style.display = "flex";
            DownloadButtonHTML.style.alignItems = "center";
            DownloadButtonHTML.style.justifyContent = "center";
            DownloadButtonHTML.style.borderRadius = '0px 0px 0px 0px';
            DownloadButtonHTML.addEventListener("click", function () {
                downloadDataHTML();
            });

            return DownloadButtonHTML;
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
                blacklistButton.style.marginLeft = "-170px";
                blacklistButton.style.marginRight = "15px";
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

        // Update hover effect based on file existence
        function updateHoverEffect(button, fileExists) {
            if (!button) {
                console.error('Blacklist button does not exist.');
                return;
            }
            if (!fileExists) {
                button.style.pointerEvents = "none"; // Disable hover effect
            } else {
                button.style.pointerEvents = "auto"; // Enable hover effect
            }
        }

        // Update blacklist button appearance based on state
        function updateBlacklistButton(button, state, fileExists = true) {
            if (!button) {
                console.error('Blacklist button does not exist.');
                return;
            }
            if (!state || !fileExists) {
                button.textContent = "Blacklist OFF";
                button.classList.remove('bg-color-4');
                button.classList.add('bg-color-2');
            } else {
                button.textContent = "Blacklist ON";
                button.classList.remove('bg-color-2');
                button.classList.add('bg-color-4');
                button.style.pointerEvents = "auto"; // Enable hover effect
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
                        updateBlacklistButton(document.getElementById("blacklist-button"), state, true);
                        updateHoverEffect(document.getElementById("blacklist-button"), true); // Update hover effect
                    })
                    .catch(error => {
                        console.error('Error checking blacklist:', error.message);
                        blacklist = [];
                        setBlacklistStateInCookie({ state: false });
                        updateBlacklistButton(document.getElementById("blacklist-button"), false, false);
                        updateHoverEffect(document.getElementById("blacklist-button"), false); // Update hover effect
                    });
            } else {
                // Blacklist is OFF, clear the blacklist
                blacklist = [];
                console.log('Blacklist disabled');
                updateBlacklistButton(document.getElementById("blacklist-button"), state, true);
                updateHoverEffect(document.getElementById("blacklist-button"), true); // Update hover effect
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

        // Check if blacklist file exists
        function checkBlacklistFileExistence() {
            const blacklistProtocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
            const port = window.location.port;
            const host = document.location.hostname;
            const blacklistUrl = `${blacklistProtocol}//${host}:${port}/logger/blacklist.txt`;

            fetch(blacklistUrl, { method: 'HEAD' })
                .then(response => {
                    if (response.ok) {
                        updateHoverEffect(document.getElementById("blacklist-button"), true); // Update hover effect
                    } else {
                        updateHoverEffect(document.getElementById("blacklist-button"), false); // Update hover effect
                    }
                })
                .catch(error => {
                    console.error('Error checking blacklist file existence:', error.message);
                    updateHoverEffect(document.getElementById("blacklist-button"), false); // Update hover effect
                });
        }

        // Initial check of blacklist state and file existence
        function checkBlacklist() {
            const blacklistState = getBlacklistStateFromCookie().state;
            updateBlacklistState(blacklistState); // Ensure blacklist state is correctly set on page load
            checkBlacklistFileExistence(); // Check blacklist file existence on page load
        }

        document.addEventListener("DOMContentLoaded", () => {
            setupBlacklistButton();
            checkBlacklist();
        });

        // Initialize the logger button
        function initializeLoggerButton() {
            setupWebSocket();

            // Ensure download buttons are initially hidden
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
        }

        // Initialize on window load
        window.onload = function () {
            initializeLoggerButton();
            checkBlacklist();
        };

        // Download data as TXT
        function downloadDataTXT() {
            const now = new Date();
            const currentDate = formatDate(now);
            const currentTime = formatTime(now);
            const filename = `RDS-LOGGER_${currentDate}_${currentTime}.txt`;

            let allData;
            if (OperatingSystem == 'linux') {
                allData = `${ServerName}\n${ServerDescription}\nRDS-LOGGER ${currentDate} ${currentTime}\n\n` +
                    `DATE       | TIME     |   FREQ  | PI      | PS        | NAME                    | CITY                | ITU | P |    ERP | DIST |  AZ | ID\n` +
                    `-----------------------------------------------------------------------------------------------------------------------------------------------\n`;
            } else {
                allData = `${ServerName}\n${ServerDescription}\nRDS-LOGGER ${currentDate} ${currentTime}\n\n` +
                    `DATE       | TIME     |   FREQ  | PI      | PS        | NAME                      | CITY                  | ITU | P |    ERP | DIST |  AZ | ID\n` +
                    `---------------------------------------------------------------------------------------------------------------------------------------------------\n`;
            }

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
            let allData = `${ServerName}\n${ServerDescription}\nRDS-LOGGER ${currentDate} ${currentTime}\n\ndate;time;freq;pi;ps;name;city;itu;pol;erp;dist;az;id\n`;

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

        // Cache for API responses
        const apiCache = {};

		// Function to download data as HTML
		async function downloadDataHTML() {
			const now = new Date();
			const currentDate = formatDate(now);
			const currentTime = formatTime(now);
			const filename = `RDS-LOGGER_${currentDate}_${currentTime}.html`;

			let allData = `<html><head><title>RDS Logger</title></head><body><pre>${ServerName}<br>${ServerDescription}<br>RDS-LOGGER ${currentDate} ${currentTime}<br><br>` +
				`<table border="1"><tr><th>DATE</th><th>TIME</th><th>FREQ</th><th>PI</th><th>PS</th><th>NAME</th><th>CITY</th><th>ITU</th><th>P</th><th>ERP</th><th>DIST</th><th>AZ</th><th>ID</th><th>FMDXPL</th><th>FMLIST</th></tr>`;

			for (let line of logDataArray) {
				let formattedLine = line.replace(/\s*\|\s*/g, "</td><td>");
				let [date, time, currentFrequency, picode, ps, station, city, itu, pol, erpTxt, distance, azimuth, id] = line.split('|').map(item => item.trim());
				let lat = LAT;
				let lon = LON;

				let link1 = picode ? `https://maps.fmdx.pl/#qth=${lat},${lon}&freq=${currentFrequency}&findPi=${picode}&itu=${itu}` : '';
				let link2 = id && FMLIST_OM_ID ? `<a href="https://www.fmlist.org/fi_inslog.php?lfd=${id}&qrb=distance&qtf=azimuth&country=${itu}&omid=${FMLIST_OM_ID}" target="_blank">FMLIST</a>` : '';

		allData += `<tr><td>${formattedLine}</td><td><a href="${link1}" target="_blank">LINK</a></td><td>${link2}</td></tr>\n`;
			}

			let finalLink = `https://maps.fmdx.pl/#qth=${LAT},${LON}&id=${idAll}&findId=*`;
			allData += `</table></pre><pre><a href="${finalLink}" target="_blank">FMDXPL ALL</a></pre></body></html>`;

			const blob = new Blob([allData], { type: "text/html" });

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


        // Get ID value from API
        async function getidValue(currentFrequency, picode, itu) {
            try {
                const modifiedFreq = currentFrequency.slice(0, -2);
                const cacheKey = `${modifiedFreq}_${itu}`;

                if (apiCache[cacheKey]) {
                    console.log('Using cache for', cacheKey);
                    return findidInData(apiCache[cacheKey], currentFrequency, picode, itu);
                }

                const apiUrl = `https://maps.fmdx.pl/api/?freq=${modifiedFreq}&itu=${itu}`;
                const corsAnywhereUrl = 'http://89.58.28.164:13128/';
                const fetchPromise = fetch(`${corsAnywhereUrl}${apiUrl}`);
                const timeoutPromise = new Promise((resolve, reject) => {
                    setTimeout(() => reject(new Error('Request timed out')), 2000);
                });

                const response = await Promise.race([fetchPromise, timeoutPromise]);
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }

                const data = await response.json();
                apiCache[cacheKey] = data; // Cache the API response
                return findidInData(data, currentFrequency, picode, itu);
            } catch (error) {
                console.error('Error fetching data:', error);
                return null;
            }
        }

        // Find ID in data
        function findidInData(data, currentFrequency, picode, itu) {
            if (data && data.locations) {
                for (let key in data.locations) {
                    const entry = data.locations[key];
                    if (entry.itu === itu && Array.isArray(entry.stations)) {
                        for (let station of entry.stations) {
                            if (station.freq === parseFloat(currentFrequency) && station.pi === picode) {
                                console.log(currentFrequency, picode, itu, 'ID found:', station.id);
                                return station.id; // Return the ID of the matching station
                            }
                        }
                    }
                }
            } else {
                console.log(`${picode} is not an array:`, JSON.stringify(data, null, 2));
            }
            return null; // No matching station found
        }

    })();
})();
