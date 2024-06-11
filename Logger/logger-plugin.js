////////////////////////////////////////////////////////////
///                                                      ///
///  RDS-LOGGER SCRIPT FOR FM-DX-WEBSERVER (V1.3a)       ///
///                                                      ///
///  by Highpoint            last update: 11.06.24       ///
///                                                      ///
///  https://github.com/Highpoint2000/webserver-logger   /// 
///                                                      ///                         
////////////////////////////////////////////////////////////

const FMLIST_OM_ID = ''; // To use the logbook function, please enter your OM ID here, for example: FMLIST_OM_ID = '1234'
const ScreenLimit = '1180'; // Set for smaller screens (default value: 1180 / smaller value: 1185) if the horizontal scroll bar appears

/////////////////////////////////////////////////////////////////////////////////////

(() => {
    const loggerPlugin = (() => {

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
        let NewLine = 'false';
        let idAll = '';
        let id = '';
        let loopCounter = 0;
		let scrollCounter = 0;

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

        // Log the coordinates to the console
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

            currentFrequency = frequency;
            displayExtractedData();
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
		scrollContainer.style.height = "100%";
		scrollContainer.style.whiteSpace = "pre-wrap";
		loggingCanvas.appendChild(scrollContainer);

		const loggingCanvasWidth = parentContainer.getBoundingClientRect().width;
		const isSmallScreen = loggingCanvasWidth < ScreenLimit;
		//console.log(loggingCanvasWidth);

        // Create and configure title div
        const titleDiv = document.createElement("div");

        if (isSmallScreen) {
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
		dataCanvas.style.height = "65%";
		dataCanvas.style.maxHeight = "65%";
		scrollContainer.appendChild(dataCanvas);

		// Adjust dataCanvas height based on scrollContainer height
		function adjustDataCanvasHeight() {
			let scrollContainerHeight = scrollContainer.getBoundingClientRect().height;
			scrollContainerHeight = Math.floor(scrollContainerHeight); // Convert to integer

			console.log('scrollContainerHeight:',scrollContainerHeight);

			if (scrollContainerHeight > 112) {
				dataCanvas.style.height = "65%";
				dataCanvas.style.maxHeight = "65%";
				dataCanvas.style.marginTop = "0px";
			} else {
				dataCanvas.style.height = "48%";
				dataCanvas.style.maxHeight = "48%";
				dataCanvas.style.marginTop = "-10px";
			}
		}

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

            const FMDXButton = createFMDXButton();
            if (FMDXButton instanceof Node) {
                downloadButtonsContainer.appendChild(FMDXButton);
            }

            const FilterButton = setupFilterButton();
            if (FilterButton instanceof Node) {
                downloadButtonsContainer.appendChild(FilterButton);
            }

            const blacklistButton = setupBlacklistButton();
            if (blacklistButton instanceof Node) {
                downloadButtonsContainer.appendChild(blacklistButton);
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

        // Variable to track the window state
        let FMDXWindow = null;
        let isOpenFMDX = false;

        // Function to create the FMDX button and link it to the overlay
        function createFMDXButton() {
            // Create the button
            const FMDXButton = document.createElement("button");
            FMDXButton.textContent = "FMDX";
            FMDXButton.style.width = "80px";
            FMDXButton.style.height = "20px";
            FMDXButton.style.marginRight = "-145%";
            FMDXButton.style.marginLeft = "-40px";
            FMDXButton.style.display = "flex";
            FMDXButton.style.alignItems = "center";
            FMDXButton.style.justifyContent = "center";
            FMDXButton.style.borderRadius = '0px';

            // Event listener for button click
            FMDXButton.addEventListener("click", function () {
                if (id) {
                    // Check if the popup window is already open
                    if (isOpenFMDX && FMDXWindow && !FMDXWindow.closed) {
                        // Close if already open
                        FMDXWindow.close();
                        isOpenFMDX = false;
                    } else {
                        // Open if not already open
                        openFMDXPage();
                        isOpenFMDX = true;
                    }
                } else {
                    alert("Station not yet fully identified!");
                }
            });

            return FMDXButton;
        }

        // Function to open the FMDX link in a popup window
        function openFMDXPage() {
            // URL for the website
            const url = `https://maps.fmdx.pl/#qth=${LAT},${LON}&id=${id}&findId=*`;

            // Open the link in a popup window
            FMDXWindow = window.open(url, "_blank", "width=600,height=400"); // Adjust the window size as needed
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

        // Function to check if a combined data entry exists in the logDataArray
        function checkIfExists(currentFrequency, picode, station, city, logDataArray) {
            const combinedData = `${currentFrequency} ${picode} ${station} ${city}`;

            const exists = logDataArray.some(entry => {
                const [,, entryFrequency, entryPicode, , entryStation, entryCity] = entry.split('|').map(value => value.trim());

                return entryFrequency === currentFrequency &&
                       entryPicode === picode &&
                       entryStation === station &&
                       entryCity === city;	
            });

            if (exists) {
                return true;
            }
            return false;
        }

        // Function to check if a frequency is in the blacklist
        function isInBlacklist(currentFrequency, blacklist) {
            return blacklist.some(entry => entry.split(' ').includes(currentFrequency));
        }

        // Function to display extracted data
        async function displayExtractedData() {
            const FilterState = getFilterStateFromCookie().state; // Automatically read the status of the filter button

            if (currentFrequency !== previousFrequency) {
                previousFrequency = currentFrequency;
                NewLine = 'true';
            }

            const now = new Date();
            const date = formatDate(now);
            const time = formatTime(now);
            const currentFrequencyWithSpaces = padLeftWithSpaces(currentFrequency, 7);
            const data = previousDataByFrequency[currentFrequency];

            const loggingCanvasWidth = parentContainer.getBoundingClientRect().width;
            const isSmallScreen = loggingCanvasWidth < ScreenLimit;

            if (data && data.picode.length > 1) {
                const station = isSmallScreen
                    ? truncateString(padRightWithSpaces(data.station, 23), 23)
                    : truncateString(padRightWithSpaces(data.station, 25), 25);
                const city = isSmallScreen
                    ? truncateString(padRightWithSpaces(data.city, 19), 19)
                    : truncateString(padRightWithSpaces(data.city, 21), 21);
                const itu = truncateString(padLeftWithSpaces(data.itu, 3), 3);
                const pol = truncateString(data.pol, 1);
                const erpTxt = truncateString(padLeftWithSpaces(String(data.erp), 6), 6);
                const distance = truncateString(padLeftWithSpaces(data.distance, 4), 4);
                const azimuth = truncateString(padLeftWithSpaces(data.azimuth, 3), 3);
                const picode = truncateString(padRightWithSpaces(data.picode, 7), 7);
                const ps = truncateString(padRightWithSpaces(data.ps.replace(/ /g, "_"), 9), 9);

                const outputText = pol 
                    ? `${date}  ${time}  ${currentFrequencyWithSpaces}  ${picode}  ${ps}  ${station}  ${city}  ${itu}  ${pol}  ${erpTxt}  ${distance}  ${azimuth}`
                    : `${date}  ${time}  ${currentFrequencyWithSpaces}  ${picode}  ${ps}`;

                let outputArray = pol 
                    ? `${date} | ${time} | ${currentFrequencyWithSpaces} | ${picode} | ${ps} | ${station} | ${city} | ${itu} | ${pol} | ${erpTxt} | ${distance} | ${azimuth}`
                    : `${date} | ${time} | ${currentFrequencyWithSpaces} | ${picode} | ${ps} |                           |                       |     |   |        |      |    `;

                if (!blacklist.length || !isInBlacklist(currentFrequency, blacklist)) {
                    if (pol && loopCounter === 0) {
                        loopCounter++;
                        if (loopCounter === 1) {
                            id = await getidValue(currentFrequency, data.picode, data.itu, data.city);

                            if (id) {
                                idAll += idAll ? `,${id}` : id;
                            }
                        }
                    }

                    if (NewLine === 'true') {
                        NewLine = 'false';
                        const newOutputDiv = document.createElement("div");
                        newOutputDiv.style.whiteSpace = "pre-wrap";
                        newOutputDiv.style.fontSize = "16px";
                        newOutputDiv.style.marginBottom = "-1px";
                        newOutputDiv.style.padding = "0 10px";
                        if (dataCanvas instanceof Node) {
                            dataCanvas.appendChild(newOutputDiv);
                        }	
						dataCanvas.scrollTop = dataCanvas.scrollHeight - dataCanvas.clientHeight;
                        id = '';
                        loopCounter = 0;
						scrollCounter = 0;

                        if (FilterState) { 
                            outputArray += ` | ${id}`;
                            logDataArray.push(outputArray);
                            if (!data.picode.includes('?') && data.station && data.city) {
                                const exists = checkIfExists(currentFrequency, data.picode, data.station, data.city, logDataArray);

                                if (exists) return;	
                                newOutputDiv.textContent = outputText;							
                                if (dataCanvas instanceof Node) {
                                    dataCanvas.appendChild(newOutputDiv);
                                }    
								dataCanvas.scrollTop = dataCanvas.scrollHeight - dataCanvas.clientHeight;							
                                outputArray += ` | ${id}`;
                                logDataArray.push(outputArray);
                                id = '';
                                loopCounter = 0;
								
                            }	
                        } else {
                            outputArray += ` | ${id}`;
                            logDataArray.push(outputArray);
                            id = '';
                            loopCounter = 0;
                        }	
                    } else {
                        if (dataCanvas && dataCanvas.lastChild) {						
													
                            if (FilterState) { 
                                if (!data.picode.includes('?') && data.station && data.city) {
                                    const lastOutputDiv = dataCanvas.lastChild;
                                    lastOutputDiv.textContent = outputText;	
									if (scrollCounter === 0) {
										dataCanvas.scrollTop = dataCanvas.scrollHeight - dataCanvas.clientHeight;
										scrollCounter = 1;
									}									
                                    outputArray += ` | ${id}`;
                                    logDataArray[logDataArray.length -1] = outputArray;
                                }						
                            } else {
                                const lastOutputDiv = dataCanvas.lastChild;
                                lastOutputDiv.textContent = outputText;
								if (scrollCounter === 0) {
									dataCanvas.scrollTop = dataCanvas.scrollHeight - dataCanvas.clientHeight;
									scrollCounter = 1;
								}
                                outputArray += ` | ${id}`;
                                logDataArray[logDataArray.length -1] = outputArray;
                            }
                        }
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
				
				// Delayed call to set the initial height
				setTimeout(adjustDataCanvasHeight, 100);
				// Optionally, add an event listener to adjust the height dynamically if the container's size changes
				window.addEventListener('resize', adjustDataCanvasHeight);	
				
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

        // Create CSV download button
        function createDownloadButtonCSV() {
            const DownloadButtonCSV = document.createElement("button");
            DownloadButtonCSV.textContent = "CSV";
            DownloadButtonCSV.style.width = "50px";
            DownloadButtonCSV.style.height = "20px";
            DownloadButtonCSV.style.display = "flex";
            DownloadButtonCSV.style.alignItems = "center";
            DownloadButtonCSV.style.justifyContent = "center";
            DownloadButtonCSV.style.borderRadius = '0px';
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
            DownloadButtonHTML.style.borderRadius = '0px';
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

        // Retrieve Filter state from cookies
        function getFilterStateFromCookie() {
            const cookieValue = document.cookie.split('; ').find(row => row.startsWith('Filter='));
            return cookieValue ? JSON.parse(cookieValue.split('=')[1]) : { state: false };
        }

        // Set Filter state in cookies
        function setFilterStateInCookie(state) {
            document.cookie = `Filter=${JSON.stringify(state)}; path=/`;
        }

        // Update Filter button appearance based on state
        function updateFilterButton(button, state) {
            if (!button) {
                console.error('Filter button does not exist.');
                return;
            }
            if (!state) {
                button.textContent = "FILTER";
                button.classList.remove('bg-color-4');
                button.classList.add('bg-color-2');
            } else {
                button.textContent = "FILTER";
                button.classList.remove('bg-color-2');
                button.classList.add('bg-color-4');
                button.style.pointerEvents = "auto"; // Enable hover effect
            }
        }

        // Setup Filter button and state
        function setupFilterButton() {
            let FilterButton = document.getElementById("Filter-button");
            const FilterState = getFilterStateFromCookie();

            if (!FilterButton) {
                FilterButton = document.createElement("button");
                FilterButton.id = "Filter-button";
                FilterButton.style.width = "100px";
                FilterButton.style.height = "20px";
                FilterButton.style.marginLeft = "-250px";
                FilterButton.style.marginRight = "5px";
                FilterButton.style.marginTop = "0px";
                FilterButton.style.display = "flex";
                FilterButton.style.alignItems = "center";
                FilterButton.style.justifyContent = "center";
                FilterButton.style.borderRadius = '0px';
                FilterButton.style.fontWeight = "bold";
                FilterButton.addEventListener("click", () => {
                    const newState = !getFilterStateFromCookie().state;
                    setFilterStateInCookie({ state: newState });
                    updateFilterButton(FilterButton, newState);
                });

                updateFilterButton(FilterButton, FilterState.state);
            }

            return FilterButton;
        }

        document.addEventListener("DOMContentLoaded", () => {
            setupFilterButton();
        });

        // Setup blacklist button and state
        function setupBlacklistButton() {
            let blacklistButton = document.getElementById("blacklist-button");
            const blacklistState = getBlacklistStateFromCookie();

            if (!blacklistButton) {
                blacklistButton = document.createElement("button");
                blacklistButton.id = "blacklist-button";
                blacklistButton.style.width = "100px";
                blacklistButton.style.height = "20px";
                blacklistButton.style.marginLeft = "0px";
                blacklistButton.style.marginRight = "140px";
                blacklistButton.style.marginTop = "0px";
                blacklistButton.style.display = "flex";
                blacklistButton.style.alignItems = "center";
                blacklistButton.style.justifyContent = "center";
                blacklistButton.style.borderRadius = '0px';
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
                button.textContent = "BLACKLIST";
                button.classList.remove('bg-color-4');
                button.classList.add('bg-color-2');
            } else {
                button.textContent = "BLACKLIST";
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
            LoggerButton.style.borderRadius = '0px';
            LoggerButton.style.width = '100px';
            LoggerButton.style.position = 'relative';
            LoggerButton.style.marginTop = '15px';
            LoggerButton.style.right = '0px';
            LoggerButton.innerHTML = '<strong>RDS-LOGGER</strong>';
            LoggerButton.classList.add('bg-color-2');

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

        // Function to sort log data by frequency
        function sortLogDataByFrequency(logDataArray) {
            return logDataArray.sort((a, b) => {
                const freqA = parseFloat(a.split('|')[2].trim());
                const freqB = parseFloat(b.split('|')[2].trim());
                return freqA - freqB;
            });
        }

        // Function to sort log data by date and time
        function sortLogDataByDateTime(logDataArray) {
            return logDataArray.sort((a, b) => {
                const dateA = new Date(`${a.split('|')[0].trim()} ${a.split('|')[1].trim()}`);
                const dateB = new Date(`${b.split('|')[0].trim()} ${b.split('|')[1].trim()}`);
                return dateA - dateB;
            });
        }

function downloadDataCSV() {
    const now = new Date();
    const currentDate = formatDate(now);
    const currentTime = formatTime(now);
    const FilterState = getFilterStateFromCookie().state; // Automatically read the status of the filter button

    const filename = `RDS-LOGGER_${currentDate}_${currentTime}.csv`;

    let allData;
    let sortedLogDataArray = [...logDataArray];

    if (FilterState) {
        // Sort the copied array by frequency and cleanedPi
        sortedLogDataArray.sort((a, b) => {
            const freqA = parseFloat(a.split('|')[2].trim());
            const freqB = parseFloat(b.split('|')[2].trim());
            const piA = a.split('|')[3].trim().replace('?', '');
            const piB = b.split('|')[3].trim().replace('?', '');
            return freqA - freqB || piA.localeCompare(piB);
        });

        allData = `"${ServerName}"\n"${ServerDescription.replace(/\n/g, ". ")}"\nRDS-LOGGER [FILTER MODE] ${currentDate} ${currentTime}\n\nfreq;pi;ps;name;city;itu;pol;erp;dist;az;id;date;time\n`;

        // Initialize the previous record for comparison
        let previousRecord = null;
        const filteredLogDataArray = [];

        sortedLogDataArray.forEach(line => {
            const [date, time, freq, pi, ps, name, city, ...rest] = line.split('|').map(value => value.trim());
            const cleanedPi = pi.replace('?', '');

            if (previousRecord) {
                const [prevFreq, prevPi, prevName, prevCity] = previousRecord;

                if (freq === prevFreq && cleanedPi === prevPi) {
                    if (name === prevName && city === prevCity) {
                        // Skip the current record
                        return;
                    } else if (prevName === "" && prevCity === "") {
                        // Replace the previous record
                        previousRecord = [freq, cleanedPi, name, city];
                        filteredLogDataArray[filteredLogDataArray.length - 1] = `${date}|${time}|${freq}|${pi}|${ps}|${name}|${city}|${rest.join('|')}`;
                        return;
                    } else {
                        // Skip the current record
                        return;
                    }
                }
            }

            previousRecord = [freq, cleanedPi, name, city];
            filteredLogDataArray.push(line);
        });

        sortedLogDataArray = filteredLogDataArray;
    } else {
        console.log(FilterState);
        allData = `"${ServerName}"\n"${ServerDescription.replace(/\n/g, ". ")}"\nRDS-LOGGER ${currentDate} ${currentTime}\n\ndate;time;freq;pi;ps;name;city;itu;pol;erp;dist;az;id\n`;
    }

    sortedLogDataArray.forEach(line => {
        const [date, time, ...rest] = line.split('|').map(value => value.trim());

        if (FilterState) {
            const modifiedLine = `${rest.join(';')};${date};${time}`;
            allData += modifiedLine + '\n';
        } else {
            const modifiedLine = line.replaceAll(/\s*\|\s*/g, ";");
            allData += modifiedLine + '\n';
        }
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

async function downloadDataHTML() {
    const now = new Date();
    const currentDate = formatDate(now);
    const currentTime = formatTime(now);
    const filename = `RDS-LOGGER_${currentDate}_${currentTime}.html`;
    let id = '';

    const filterState = getFilterStateFromCookie().state;

    let allData = `<html><head><title>RDS Logger</title></head><body><pre>${ServerName}<br>${ServerDescription.replace(/\n/g, "<br>")}<br>`;
    allData += filterState ? `RDS-LOGGER [FILTER MODE] ${currentDate} ${currentTime}<br><br>` : `RDS-LOGGER ${currentDate} ${currentTime}<br><br>`;

    if (filterState) {
        allData += `<table border="1"><tr><th>FREQ</th><th>PI</th><th>PS</th><th>NAME</th><th>CITY</th><th>ITU</th><th>P</th><th>ERP</th><th>DIST</th><th>AZ</th><th>ID</th><th>DATE</th><th>TIME</th><th>FMDX</th><th>FMLIST</th></tr>`;
    } else {
        allData += `<table border="1"><tr><th>DATE</th><th>TIME</th><th>FREQ</th><th>PI</th><th>PS</th><th>NAME</th><th>CITY</th><th>ITU</th><th>P</th><th>ERP</th><th>DIST</th><th>AZ</th><th>ID</th><th>FMDX</th><th>FMLIST</th></tr>`;
    }

    let sortedLogDataArray = [...logDataArray];

    if (filterState) {
        sortedLogDataArray.sort((a, b) => {
            const [dateA, timeA, freqA, piA] = a.split('|').map((value, index) => index === 2 ? parseFloat(value.trim()) : value.trim().replace('?', ''));
            const [dateB, timeB, freqB, piB] = b.split('|').map((value, index) => index === 2 ? parseFloat(value.trim()) : value.trim().replace('?', ''));
            if (freqA === freqB) {
                return piA.localeCompare(piB);
            }
            return freqA - freqB;
        });

        // Initialize the previous record for comparison
        let previousRecord = null;
        const filteredLogDataArray = [];

        sortedLogDataArray.forEach(line => {
            let [date, time, freq, pi, ps, name, city, itu, pol, erpTxt, distance, azimuth, id] = line.split('|').map(value => value.trim());
            const cleanedPi = pi.replace('?', '');

            if (previousRecord) {
                const [prevFreq, prevPi, prevName, prevCity] = previousRecord;

                if (freq === prevFreq && cleanedPi === prevPi) {
                    if (name === prevName && city === prevCity) {
                        // Skip the current record
                        return;
                    } else if (prevName === "" && prevCity === "") {
                        // Replace the previous record
                        previousRecord = [freq, cleanedPi, name, city];
                        filteredLogDataArray[filteredLogDataArray.length - 1] = line;
                        return;
                    } else {
                        // Skip the current record
                        return;
                    }
                }
            }

            previousRecord = [freq, cleanedPi, name, city];
            filteredLogDataArray.push(line);
        });

        sortedLogDataArray = filteredLogDataArray;
    }

    sortedLogDataArray.forEach(line => {
        let [date, time, freq, pi, ps, name, city, itu, pol, erpTxt, distance, azimuth, id] = line.split('|').map(value => value.trim());

        let formattedLine = line.replace(/\s*\|\s*/g, "</td><td>");
        let link1 = id !== '' ? `https://maps.fmdx.pl/#qth=${LAT},${LON}&id=${id}&findId=*` : ' ';
        let link2 = FMLIST_OM_ID !== '' ? `<a href="https://www.fmlist.org/fi_inslog.php?lfd=${id}&qrb=${distance}&qtf=${azimuth}&country=${itu}&omid=${FMLIST_OM_ID}" target="_blank">FMLIST</a>` : ' ';

        if (filterState) {
            allData += `<tr><td>${freq}</td><td>${pi}</td><td>${ps}</td><td>${name}</td><td>${city}</td><td>${itu}</td><td>${pol}</td><td>${erpTxt}</td><td>${distance}</td><td>${azimuth}</td><td>${id}</td><td>${date}</td><td>${time}</td><td><a href="${link1}" target="_blank">LINK</a></td><td>${link2}</td></tr>\n`;
        } else {
            allData += `<tr><td>${date}</td><td>${time}</td><td>${freq}</td><td>${pi}</td><td>${ps}</td><td>${name}</td><td>${city}</td><td>${itu}</td><td>${pol}</td><td>${erpTxt}</td><td>${distance}</td><td>${azimuth}</td><td>${id}</td><td><a href="${link1}" target="_blank">LINK</a></td><td>${link2}</td></tr>\n`;
        }
    });

    let finalLink = `https://maps.fmdx.pl/#qth=${LAT},${LON}&id=${idAll}&findId=*`;
    allData += `</table></pre><pre><a href="${finalLink}" target="_blank">FMDX ALL</a></pre></body></html>`;

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
        async function getidValue(currentFrequency, picode, itu, city) {
            try {
                const modifiedFreq = currentFrequency.slice(0, -2);
                const cacheKey = `${modifiedFreq}_${itu}`;

                if (apiCache[cacheKey]) {
                    console.log('Using cache for', cacheKey);
                    return findidInData(apiCache[cacheKey], currentFrequency, picode, itu, city);
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
                return findidInData(data, currentFrequency, picode, itu, city);
            } catch (error) {
                console.error('Error fetching data:', error);
                return null;
            }
        }

        // Find ID in data
        function findidInData(data, currentFrequency, picode, itu, city) {
            if (data && data.locations) {
                for (let key in data.locations) {
                    const entry = data.locations[key];
                    if (entry.name === city && entry.itu === itu && Array.isArray(entry.stations)) {
                        for (let station of entry.stations) {
                            if (station.freq === parseFloat(currentFrequency) && station.pi === picode) {
                                console.log(currentFrequency, picode, itu, city, 'ID found:', station.id);
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
