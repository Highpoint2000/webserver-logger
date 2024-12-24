////////////////////////////////////////////////////////////
///                                                      ///
///  RDS-LOGGER SCRIPT FOR FM-DX-WEBSERVER (V1.6d)		 ///
///                                                      ///
///  by Highpoint                last update: 24.12.24   ///
///                                                      ///
///  https://github.com/Highpoint2000/webserver-logger   ///
///                                                      ///
////////////////////////////////////////////////////////////

// This plugin works only from web server version 1.2.6!!!

(() => {
	
// Default values - set your personal settings in the configPlugin.json!

let FMLIST_OM_ID = '';           
let Screen = '';                 
let ScannerButtonView = false;   
let UTCtime = true;   
let updateInfo = true;            

const plugin_version = '1.6d'; // Plugin version
const plugin_path = 'https://raw.githubusercontent.com/highpoint2000/webserver-logger/';
const plugin_JSfile = 'main/Logger/logger-plugin.js'
const plugin_name = 'RDS Logger';

// Function to load configPlugin.json from /js/plugins/Logger directory (WINDOWS SYSTEMS ONLY)
function loadConfig() {
    return fetch('/js/plugins/Logger/configPlugin.json') // Updated path to /js/plugins/Logger
        .then(response => {
            if (!response.ok) {
                console.warn('Config file not found, using default values.');
                return null; // Return null to trigger default values
            }
            return response.json();
        })
        .then(config => {
            if (config) {
                // Override default values with values from config.json
                FMLIST_OM_ID = config.FMLIST_OM_ID || FMLIST_OM_ID;
                Screen = config.Screen || Screen;
                ScannerButtonView = (typeof config.ScannerButtonView === 'boolean') ? config.ScannerButtonView : ScannerButtonView;
                UTCtime = (typeof config.UTCtime === 'boolean') ? config.UTCtime : UTCtime;
				updateInfo = (typeof config.updateInfo === 'boolean') ? config.updateInfo : updateInfo;
                console.log("RDS-Logger successfully loaded config from configPlugin.json.");
            } else {
                console.log("Using default configuration values.");
            }
        })
        .catch(error => {
            console.log("RDS-Logger failed to load configPlugin.json:", error);
        });
}

// Load config on startup and then load RDSLogger
loadConfig().then(() => {
    loadRDSLogger();
});

let isTuneAuthenticated;
const PluginUpdateKey = `${plugin_name}_lastUpdateNotification`; // Unique key for localStorage

// Function to check if the notification was shown today
function shouldShowNotification() {
    const lastNotificationDate = localStorage.getItem(PluginUpdateKey);
    const today = new Date().toISOString().split('T')[0]; // Get current date in YYYY-MM-DD format

    if (lastNotificationDate === today) {
      return false; // Notification already shown today
    }
    // Update the date in localStorage to today
    localStorage.setItem(PluginUpdateKey, today);
    return true;
  }

// Function to check plugin version
function checkPluginVersion() {
    // Fetch and evaluate the plugin script
    fetch(`${plugin_path}${plugin_JSfile}`)
      .then(response => response.text())
      .then(script => {
        // Search for plugin_version in the external script
        const pluginVersionMatch = script.match(/const plugin_version = '([\d.]+[a-z]*)?';/);
        if (!pluginVersionMatch) {
          console.error(`${plugin_name}: Plugin version could not be found`);
          return;
        }

        const externalPluginVersion = pluginVersionMatch[1];

        // Function to compare versions
		function compareVersions(local, remote) {
			const parseVersion = (version) =>
				version.split(/(\d+|[a-z]+)/i).filter(Boolean).map((part) => (isNaN(part) ? part : parseInt(part, 10)));

			const localParts = parseVersion(local);
			const remoteParts = parseVersion(remote);

			for (let i = 0; i < Math.max(localParts.length, remoteParts.length); i++) {
				const localPart = localParts[i] || 0; // Default to 0 if part is missing
				const remotePart = remoteParts[i] || 0;

				if (typeof localPart === 'number' && typeof remotePart === 'number') {
					if (localPart > remotePart) return 1;
					if (localPart < remotePart) return -1;
				} else if (typeof localPart === 'string' && typeof remotePart === 'string') {
					// Lexicographical comparison for strings
					if (localPart > remotePart) return 1;
					if (localPart < remotePart) return -1;
				} else {
					// Numeric parts are "less than" string parts (e.g., `3.5` < `3.5a`)
					return typeof localPart === 'number' ? -1 : 1;
				}
			}

			return 0; // Versions are equal
		}

        // Check version and show notification if needed
        const comparisonResult = compareVersions(plugin_version, externalPluginVersion);
        if (comparisonResult === 1) {
          // Local version is newer than the external version
          console.log(`${plugin_name}: The local version is newer than the plugin version.`);
        } else if (comparisonResult === -1) {
          // External version is newer and notification should be shown
          if (shouldShowNotification()) {
            console.log(`${plugin_name}: Plugin update available: ${plugin_version} -> ${externalPluginVersion}`);
			sendToast('warning important', `${plugin_name}`, `Update available:<br>${plugin_version} -> ${externalPluginVersion}`, false, false);
            }
        } else {
          // Versions are the same
          console.log(`${plugin_name}: The local version matches the plugin version.`);
        }
      })
      .catch(error => {
        console.error(`${plugin_name}: Error fetching the plugin script:`, error);
      });
}

function delay(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

function loadRDSLogger() {
	
    // CSS styles for button wrapper
    const buttonWrapperStyles = `
        display: flex;
        justify-content: left;
        align-items: center;
        margin-top: 0px;
    `;

    // Immediately Invoked Function Expression (IIFE) to encapsulate the loggerPlugin code
    const loggerPlugin = (() => {
        let displayedPiCodes = [];
        let logDataArray = [];
        let FilteredlogDataArray = [];
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
        let stationidAll = '';
        let id = '';
        let loopCounter = 0;
        let scrollCounter = 0;
        let SaveFrequency = '';
        let Savepicode = '';
        let Savestation = '';
        let Savestationid = '';
        let Saveps = '';
        let dateFilter = '';
        let timeFilter = '';
        let picode_clean = '';

        console.log('ServerName:', ServerName);
        console.log('ServerDescription:', ServerDescription);

        // Setup WebSocket connection
        async function setupWebSocket() {
            if (!autoScanSocket || autoScanSocket.readyState === WebSocket.CLOSED) {
                try {
                    autoScanSocket = await window.socketPromise;

                    autoScanSocket.addEventListener("open", () => {
                        console.log("WebSocket connected.");
                    });

                    autoScanSocket.addEventListener("message", handleWebSocketMessage);

                    autoScanSocket.addEventListener("error", (error) => {
                        console.error("WebSocket error:", error);
                    });

                    autoScanSocket.addEventListener("close", (event) => {
                        console.log("WebSocket closed:", event);
                        // Optionally, attempt to reconnect after a delay
                        setTimeout(setupWebSocket, 5000);
                    });

                } catch (error) {
                    console.error("Failed to setup WebSocket:", error);
                }
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
		
			if (eventData.ps_errors && typeof eventData.ps_errors === 'string' && /\b(5|6|7|8|9|10)\b/.test(eventData.ps_errors)) {
				ps += "?";
			}
	
			if (ps === "") {
				ps = "?";
			}

            previousDataByFrequency[frequency] = {
                picode: eventData.pi,
                ps: ps,
                station: txInfo ? txInfo.tx : "",
                pol: txInfo ? txInfo.pol : "",
                erp: txInfo ? txInfo.erp : "",
                city: txInfo ? txInfo.city : "",
                itu: txInfo ? txInfo.itu : "",
                distance: txInfo ? txInfo.dist : "",
                azimuth: txInfo ? txInfo.azi : "",
                stationid: txInfo ? txInfo.id : ""
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
        let parentContainer = document.querySelector(".canvas-container");
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
        loggingCanvas.style.width = "97%";
        loggingCanvas.style.marginTop = "0px";
        loggingCanvas.style.marginRight = "0px";
        loggingCanvas.style.marginLeft = "20px";
        loggingCanvas.style.display = 'none';
        loggingCanvas.style.border = "1px solid ";
        loggingCanvas.classList.add('color-4');
        loggingCanvas.style.backgroundColor = "var(--color-1-transparent)";
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

        // Create and configure title div
        const titleDiv = document.createElement("div");

        if (UTCtime) {
            if (Screen === 'ultrasmall') {
                titleDiv.innerHTML = "<h2 style='margin-top: 0px; font-size: 16px;'><strong>DATE        TIME(UTC)  FREQ    PI       PS         NAME                 CITY             ITU POL    ERP  DIST   AZ</strong></h2>";
            } else if (Screen === 'small') {
                titleDiv.innerHTML = "<h2 style='margin-top: 0px; font-size: 16px;'><strong>DATE        TIME(UTC)  FREQ    PI       PS         NAME                     CITY                 ITU POL    ERP  DIST   AZ</strong></h2>";
            } else {
                titleDiv.innerHTML = "<h2 style='margin-top: 0px; font-size: 16px;'><strong>DATE        TIME(UTC)  FREQ    PI       PS         NAME                       CITY                   ITU POL    ERP  DIST   AZ</strong></h2>";
            }
        } else {
            if (Screen === 'ultrasmall') {
                titleDiv.innerHTML = "<h2 style='margin-top: 0px; font-size: 16px;'><strong>DATE        TIME       FREQ    PI       PS         NAME                 CITY             ITU POL    ERP  DIST   AZ</strong></h2>";
            } else if (Screen === 'small') {
                titleDiv.innerHTML = "<h2 style='margin-top: 0px; font-size: 16px;'><strong>DATE        TIME       FREQ    PI       PS         NAME                     CITY                 ITU POL    ERP  DIST   AZ</strong></h2>";
            } else {
                titleDiv.innerHTML = "<h2 style='margin-top: 0px; font-size: 16px;'><strong>DATE        TIME       FREQ    PI       PS         NAME                       CITY                   ITU POL    ERP  DIST   AZ</strong></h2>";
            }
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

            console.log('scrollContainerHeight:', scrollContainerHeight);

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

        let ButtonsContainer = document.querySelector(".download-buttons-container");

        if (!ButtonsContainer) {
            ButtonsContainer = document.createElement("div");
            ButtonsContainer.className = "download-buttons-container";
            ButtonsContainer.style.display = "none";
            ButtonsContainer.style.position = "relative";
            ButtonsContainer.style.marginLeft = "0px";
            ButtonsContainer.style.marginTop = "0px";
            ButtonsContainer.style.textAlign = "left"; // Ensures left alignment

            const FilterButton = setupFilterButton();
            if (FilterButton instanceof Node) {
                ButtonsContainer.appendChild(FilterButton);
            }

            if (ScannerButtonView) {
                const ScannerButton = setupScannerButton();
                if (ScannerButton instanceof Node) {
                    ButtonsContainer.appendChild(ScannerButton);
                }
            }

            const blacklistButton = setupBlacklistButton();
            if (blacklistButton instanceof Node) {
                ButtonsContainer.appendChild(blacklistButton);
            }

            const DownloadButtonCSV = createDownloadButtonCSV();
            if (DownloadButtonCSV instanceof Node) {
                ButtonsContainer.appendChild(DownloadButtonCSV);
            }

            const DownloadButtonHTML = createDownloadButtonHTML();
            if (DownloadButtonHTML instanceof Node) {
                ButtonsContainer.appendChild(DownloadButtonHTML);
            }

            const MAPALLButton = createMAPALLButton();
            if (MAPALLButton instanceof Node) {
                ButtonsContainer.appendChild(MAPALLButton);
            }

            const FMLISTButton = createFMLISTButton();
            if (FMLISTButton instanceof Node) {
                ButtonsContainer.appendChild(FMLISTButton);
            }

            if (parentContainer instanceof Node) {
                parentContainer.appendChild(ButtonsContainer);
            }
        }

        // Variable to track the window state
        let FMDXWindow = null;
        let isOpenFMDX = false;

        // Function to create the MAPALL button and link it to the overlay
        function createMAPALLButton() {
            // Create the button
            const MAPALLButton = document.createElement("button");
            MAPALLButton.textContent = "MAPALL";
            MAPALLButton.style.width = "80px";
            MAPALLButton.style.height = "20px";
            MAPALLButton.style.marginLeft = "140px";
            MAPALLButton.style.display = "flex";
            MAPALLButton.style.alignItems = "center";
            MAPALLButton.style.justifyContent = "center";
            MAPALLButton.style.borderRadius = '0px';

            // Function to update the button's class based on uniqueStationIds
            function updateMAPALLButtonClass() {
                const stationidArray = collectStationIds();
                const uniqueStationIds = [...new Set(stationidArray)].join(',');

                if (uniqueStationIds.length > 0) {
                    MAPALLButton.classList.remove('bg-color-2');
                    MAPALLButton.classList.add('bg-color-4');
                    MAPALLButton.classList.remove('inactive');
                    MAPALLButton.classList.add('active');
                    MAPALLButton.disabled = false;
                } else {
                    MAPALLButton.classList.remove('bg-color-4');
                    MAPALLButton.classList.add('bg-color-2');
                    MAPALLButton.classList.remove('active');
                    MAPALLButton.classList.add('inactive');
                    MAPALLButton.disabled = true;
                }
            }

            // Event listener for button click
            MAPALLButton.addEventListener("click", function () {
                if (isOpenFMDX && FMDXWindow && !FMDXWindow.closed) {
                    FMDXWindow.close();
                    isOpenFMDX = false;
                } else {
                    openFMDXPage();
                    isOpenFMDX = true;
                }
            });

            // Set an interval to continually check and update the button's class
            setInterval(updateMAPALLButtonClass, 100); // Check every 100 milliseconds

            return MAPALLButton;
        }

        // Function to open the FMDX link in a popup window
        function openFMDXPage() {
            const stationidArray = collectStationIds();
            const uniqueStationIds = [...new Set(stationidArray)].join(',');

            if (uniqueStationIds.length > 0) {
                const url = `https://maps.fmdx.org/#qth=${LAT},${LON}&id=${uniqueStationIds}&findId=*`;
                FMDXWindow = window.open(url, "_blank", "width=600,height=400");
            }
        }

        // Function to extract the stationid from an array entry
        function extractStationId(entry) {
            if (typeof entry === 'undefined') {
                return null;
            }

            const entryParts = entry.split(' | ');
            if (entryParts.length >= 13) {
                return entryParts[12]; // Extract the 13th element (index 12)
            } else {
                return null;
            }
        }

        // Function to collect all station IDs from FilteredlogDataArray and logDataArray
        function collectStationIds() {
            let stationidArray = [];

            if (FilteredlogDataArray.length > 0) {
                for (let i = 0; i < FilteredlogDataArray.length; i++) {
                    const stationid = extractStationId(FilteredlogDataArray[i]);
                    if (stationid !== null) {
                        stationidArray.push(stationid);
                    }
                }
            }

            if (logDataArray.length > 0) {
                for (let i = 0; i < logDataArray.length; i++) {
                    const stationid = extractStationId(logDataArray[i]);
                    if (stationid !== null) {
                        stationidArray.push(stationid);
                    }
                }
            }

            return stationidArray;
        }

        // Variable to track the window state
        let FMLISTWindow = null;
        let isOpenFMLIST = false;

        // Function to create the FMLIST button and link it to the overlay
        function createFMLISTButton() {
            // Create a container for the button or placeholder
            const container = document.createElement("div");
            container.style.width = "80px";
            container.style.height = "20px";
            container.style.marginRight = "0px";
            container.style.marginLeft = "5px";
            container.style.display = "flex";
            container.style.alignItems = "center";
            container.style.justifyContent = "center";
            container.style.borderRadius = '0px';

            // Check if FMLIST_OM_ID is not empty
            if (FMLIST_OM_ID) {
                // Create the button
                const FMLISTButton = document.createElement("button");
                FMLISTButton.textContent = "FMLIST";
                FMLISTButton.style.width = "100%";
                FMLISTButton.style.height = "100%";
                FMLISTButton.style.borderRadius = '0px';

                // Function to update the button's class based on station
                function updateFMLISTButtonClass() {
                    const data = previousDataByFrequency[currentFrequency];
                    const station = data ? data.station : '';
                    stationid = data ? data.stationid : '';

                    if (station !== '' && FMLIST_OM_ID && !isInBlacklist(currentFrequency, blacklist)) {
                        FMLISTButton.classList.remove('bg-color-2');
                        FMLISTButton.classList.add('bg-color-4');
                        FMLISTButton.classList.remove('inactive');
                        FMLISTButton.classList.add('active');
                        FMLISTButton.disabled = false;
                    } else {
                        FMLISTButton.classList.remove('bg-color-4');
                        FMLISTButton.classList.add('bg-color-2');
                        FMLISTButton.classList.remove('active');
                        FMLISTButton.classList.add('inactive');
                        FMLISTButton.disabled = true;
                    }
                }

                // Event listener for button click
                FMLISTButton.addEventListener("click", function () {
                    if (stationid > 0) {
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
                        alert(`Station-ID: ${stationid} is not compatible with FMLIST Database!`);
                    }
                });

                // Set an interval to continually check and update the button's class
                setInterval(updateFMLISTButtonClass, 100); // Check every 100 milliseconds

                // Add the button to the container
                container.appendChild(FMLISTButton);
            }

            return container;
        }

        // Function to open the FMLIST link in a popup window
        function openFMLISTPage(distance, azimuth, itu) {
            // URL for the website
            const url = `https://www.fmlist.org/fi_inslog.php?lfd=${stationid}&qrb=${distance}&qtf=${azimuth}&country=${itu}&omid=${FMLIST_OM_ID}`;

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

            return exists;
        }

        // Function to check if a frequency is in the blacklist
        function isInBlacklist(currentFrequency, blacklist) {
            return blacklist.some(entry => entry.split(' ').includes(currentFrequency));
        }

        // Function to display extracted data
        async function displayExtractedData() {
            const FilterState = getFilterStateFromCookie().state; // Automatically read the status of the filter button
            const now = new Date();
            const date = formatDate(now);
            let time = formatTime(now);

            if (UTCtime) {
                time = getCurrentUTC(); // Time in UTC
            }

            const currentFrequencyWithSpaces = padLeftWithSpaces(currentFrequency, 7);
            const data = previousDataByFrequency[currentFrequency];

            const loggingCanvasWidth = parentContainer.getBoundingClientRect().width;

            let station = "";
            let city = "";
            let itu = "";
            let pol = "";
            let erpTxt = "";
            let distance = "";
            let azimuth = "";
            let picode = "";
            let ps = "";
            let stationid = "";

            station = Screen === 'ultrasmall' ? truncateString(padRightWithSpaces(data.station, 19), 19) : Screen === 'small' ? truncateString(padRightWithSpaces(data.station, 23), 23) : truncateString(padRightWithSpaces(data.station, 25), 25);
            city = Screen === 'ultrasmall' ? truncateString(padRightWithSpaces(data.city, 15), 15) : Screen === 'small' ? truncateString(padRightWithSpaces(data.city, 19), 19) : truncateString(padRightWithSpaces(data.city, 21), 21);
            itu = truncateString(padLeftWithSpaces(data.itu, 3), 3);
            pol = truncateString(data.pol, 1);
            erpTxt = truncateString(padLeftWithSpaces(String(data.erp), 6), 6);
            distance = truncateString(padLeftWithSpaces(data.distance, 4), 4);
            azimuth = truncateString(padLeftWithSpaces(data.azimuth, 3), 3);
            picode = truncateString(padRightWithSpaces(data.picode, 7), 7);
            ps = truncateString(padRightWithSpaces(data.ps.replace(/ /g, "_"), 9), 9);
            stationid = data.stationid;
            picode_clean = data.picode;

            if (currentFrequency !== previousFrequency || previousFrequency === '') {
                dateFilter = formatDate(now);
                if (UTCtime) {
                    timeFilter = getCurrentUTC(); // Time in UTC
                } else {
                    timeFilter = formatTime(now);
                }
                if (data.picode.length > 1) {
                    previousFrequency = currentFrequency;
                    NewLine = 'true';
                    id = '';
                    dateFilter = formatDate(now);
                    Savepicode = picode_clean;
                }
            }

            if (!FilterState) {
                if (UTCtime) {
                    timeFilter = getCurrentUTC(); // Time in UTC
                } else {
                    timeFilter = formatTime(now);
                }
            }

            if (!blacklist.length || !isInBlacklist(currentFrequency, blacklist)) {

                const outputText = station
                    ? `${date}  ${time}  ${currentFrequencyWithSpaces}  ${picode}  ${ps}  ${station}  ${city}  ${itu}  ${pol}  ${erpTxt}  ${distance}  ${azimuth}`
                    : `${date}  ${time}  ${currentFrequencyWithSpaces}  ${picode}  ${ps}`;

                const outputTextFilter = station
                    ? `${dateFilter}  ${timeFilter}  ${currentFrequencyWithSpaces}  ${picode}  ${ps}  ${station}  ${city}  ${itu}  ${pol}  ${erpTxt}  ${distance}  ${azimuth}`
                    : `${dateFilter}  ${timeFilter}  ${currentFrequencyWithSpaces}  ${picode}  ${ps}`;

                let outputArray = station
                    ? `${date} | ${time} | ${currentFrequencyWithSpaces} | ${picode} | ${ps} | ${station} | ${city} | ${itu} | ${pol} | ${erpTxt} | ${distance} | ${azimuth} | ${stationid}`
                    : `${date} | ${time} | ${currentFrequencyWithSpaces} | ${picode} | ${ps} |                           |                       |     |   |        |      |    `;

                let outputArrayFilter = station
                    ? `${dateFilter} | ${timeFilter} | ${currentFrequencyWithSpaces} | ${picode} | ${ps} | ${station} | ${city} | ${itu} | ${pol} | ${erpTxt} | ${distance} | ${azimuth} | ${stationid}`
                    : `${dateFilter} | ${timeFilter} | ${currentFrequencyWithSpaces} | ${picode} | ${ps} |                           |                       |     |   |        |      |    `;

                const newOutputDiv = document.createElement("div");
                newOutputDiv.style.whiteSpace = "pre-wrap";
                newOutputDiv.style.fontSize = "16px";
                newOutputDiv.style.marginBottom = "-1px";
                newOutputDiv.style.padding = "0 10px";
                let lastOutputArray;

                if (NewLine === 'true' && data.picode.length > 1 || picode_clean.replace(/\?/g, '') !== Savepicode.replace(/\?/g, '') && (ps !== '?' && station !== '')) {
                    if (dataCanvas instanceof Node) {
                        dataCanvas.appendChild(newOutputDiv);
                    }

                    if (!picode.includes('??') && !picode.includes('???')) {
                        if (FilterState && data.picode.length > 1) {
                            const lastOutputDiv = dataCanvas.lastChild;
                            lastOutputDiv.textContent = outputTextFilter;
                        }
                        lastOutputArray = outputArrayFilter;
                    }

                    if (FilterState && data.picode.length > 1) {
                        FilteredlogDataArray[FilteredlogDataArray.length + 1] = lastOutputArray;
                    }

                    NewLine = 'false';
                }

                if ((ps !== '?' && station !== '') && !picode_clean.includes('??') && !picode_clean.includes('???') && data.picode.length > 1) {
                    if (FilterState) {
                        const lastOutputDiv = dataCanvas.lastChild;
                        lastOutputDiv.textContent = outputTextFilter;
                    }

                    FilteredlogDataArray[FilteredlogDataArray.length - 1] = outputArrayFilter;
                    SaveFrequency = currentFrequencyWithSpaces.replace(/\s/g, '');
                }

                if (NewLine === 'true' && data.picode.length > 1 || Savepicode !== picode_clean || Savestation !== station && station !== '' || Saveps !== ps && ps !== '') {
                    if (!FilterState) {
                        if (dataCanvas instanceof Node) {
                            dataCanvas.appendChild(newOutputDiv);
                        }
                        if (data.picode.length > 1) {
                            const lastOutputDiv = dataCanvas.lastChild;
                            lastOutputDiv.textContent = outputText;
                        }
                    }

                    if (data.picode.length > 1) {
                        logDataArray[logDataArray.length + 1] = outputArray;
                    }

                    NewLine = 'false';
                }

                Savepicode = picode_clean;
                Savestation = station;
                Savestationid = stationid;
                Saveps = ps;
                const { scrollTop, scrollHeight, clientHeight } = dataCanvas; 
				userIsAtBottom = scrollTop + clientHeight >= scrollHeight - 20; // Adjusted threshold
				if (userIsAtBottom) dataCanvas.scrollTop = dataCanvas.scrollHeight - dataCanvas.clientHeight;
			}
        }

        // Toggle logger state and update UI accordingly
        function toggleLogger() {
			if (!document.querySelector("#signal-canvas")?.offsetParent && !isLoggerOn) return;
            const LoggerButton = document.getElementById('Log-on-off');
            const ButtonsContainer = document.querySelector('.download-buttons-container');
            const antennaImage = document.querySelector('#antenna'); // Ensure ID 'antenna' is correct
            isLoggerOn = !isLoggerOn;		

            if (isLoggerOn) {
                // Update button appearance
                LoggerButton.classList.remove('bg-color-2');
                LoggerButton.classList.add('bg-color-4');

                // Perform actions when logger is on
                displaySignalOutput();

                // Set initial height with delay
                setTimeout(adjustDataCanvasHeight, 100);
                // Adjust height dynamically on window resize
                window.addEventListener('resize', adjustDataCanvasHeight);

                // Show download buttons or create them if not already present
                if (ButtonsContainer) {
                    ButtonsContainer.style.display = 'flex';
                } else {
                    createDownloadButtons(); // Function to create download buttons if not already created
                }

                // Hide antenna image
                if (antennaImage) {
                    antennaImage.style.visibility = 'hidden';
                }

            } else {
                // Update button appearance
                LoggerButton.classList.remove('bg-color-4');
                LoggerButton.classList.add('bg-color-2');

                // Perform actions when logger is off
                displaySignalCanvas();

                // Hide download buttons
                if (ButtonsContainer) {
                    ButtonsContainer.style.display = 'none';
                }

                // Show antenna image
                if (antennaImage) {
                    antennaImage.style.visibility = 'visible';
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
            DownloadButtonHTML.style.marginRight = "0px";
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
            const ContainerRotator = document.getElementById('containerRotator');
            if (ContainerRotator) {
                ContainerRotator.style.display = 'block';
            }
            const ContainerAntenna = document.getElementById('Antenna');
            if (ContainerAntenna) {
                ContainerAntenna.style.display = 'block';
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
            const ContainerRotator = document.getElementById('containerRotator');
            if (ContainerRotator) {
                ContainerRotator.style.display = 'none';
            }
            const ContainerAntenna = document.getElementById('Antenna');
            if (ContainerAntenna) {
                ContainerAntenna.style.display = 'none';
                ButtonsContainer.style.marginLeft = "-20.5%";
                ButtonsContainer.style.marginTop = "166px";
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

        // Retrieve Filter state from cookies
        function getFilterStateFromCookie() {
            const cookieValue = document.cookie.split('; ').find(row => row.startsWith('Filter='));
            return cookieValue ? JSON.parse(cookieValue.split('=')[1]) : { state: true }; // Default to active state
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
                FilterButton.style.marginTop = "0px";
                FilterButton.style.display = "flex";
                FilterButton.style.alignItems = "center";
                FilterButton.style.justifyContent = "center";
                FilterButton.style.borderRadius = '0px';
                FilterButton.style.fontWeight = "bold";

                setTimeout(() => {
                    const ContainerAntenna = document.getElementById('Antenna');
                    if (ContainerAntenna) {
                        if (ScannerButtonView) {
                            FilterButton.style.marginLeft = "-775px";
                        } else {
                            FilterButton.style.marginLeft = "-725px";
                        }
                    } else {
                        if (ScannerButtonView) {
                            FilterButton.style.marginLeft = "150px";
                        } else {
                            FilterButton.style.marginLeft = "200px";
                        }
                    }
                }, 1000);

                FilterButton.addEventListener("click", () => {
                    const newState = !getFilterStateFromCookie().state;
                    setFilterStateInCookie({ state: newState });
                    updateFilterButton(FilterButton, newState);
                });

                updateFilterButton(FilterButton, FilterState.state);
            }

            return FilterButton;
        }

        // Call setupFilterButton to initialize on page load
        setupFilterButton();

        document.addEventListener("DOMContentLoaded", () => {
            setupFilterButton();
        });

        // Retrieve Scanner state from cookies
        function getScannerStateFromCookie() {
            const cookieValue = document.cookie.split('; ').find(row => row.startsWith('Scanner='));
            return cookieValue ? JSON.parse(cookieValue.split('=')[1]) : { state: false };
        }

        // Set Scanner state in cookies
        function setScannerStateInCookie(state) {
            document.cookie = `Scanner=${JSON.stringify(state)}; path=/`;
        }

        // Update Scanner button appearance based on state
        function updateScannerButton(button, state) {
            if (!button) {
                console.error('Scanner button does not exist.');
                return;
            }
            if (!state) {
                button.textContent = "SCANNER";
                button.classList.remove('bg-color-4');
                button.classList.add('bg-color-2');
            } else {
                button.textContent = "SCANNER";
                button.classList.remove('bg-color-2');
                button.classList.add('bg-color-4');
                button.style.pointerEvents = "auto"; // Enable hover effect
            }
        }

        // Setup Scanner button and state
        function setupScannerButton() {
            let ScannerButton = document.getElementById("Scanner-button");
            const ScannerState = getScannerStateFromCookie();

            if (!ScannerButton) {
                ScannerButton = document.createElement("button");
                ScannerButton.id = "Scanner-button";
                ScannerButton.style.width = "100px";
                ScannerButton.style.height = "20px";
                ScannerButton.style.marginLeft = "5px";
                ScannerButton.style.marginTop = "0px";
                ScannerButton.style.display = "flex";
                ScannerButton.style.alignItems = "center";
                ScannerButton.style.justifyContent = "center";
                ScannerButton.style.borderRadius = '0px';
                ScannerButton.style.fontWeight = "bold";
                ScannerButton.addEventListener("click", () => {
                    const newState = !getScannerStateFromCookie().state;
                    setScannerStateInCookie({ state: newState });
                    updateScannerButton(ScannerButton, newState);
                });

                updateScannerButton(ScannerButton, ScannerState.state);
            }

            return ScannerButton;
        }

        document.addEventListener("DOMContentLoaded", () => {
            setupScannerButton();
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
                blacklistButton.style.marginLeft = "5px";
                blacklistButton.style.marginTop = "0px";
                blacklistButton.style.display = "flex";
                blacklistButton.style.alignItems = "center";
                blacklistButton.style.justifyContent = "center";
                blacklistButton.style.borderRadius = '0px';
                blacklistButton.style.fontWeight = "bold";

                if (ScannerButtonView) {
                    blacklistButton.style.marginRight = "95px";
                } else {
                    blacklistButton.style.marginRight = "145px";
                }

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
                        // console.error('Error checking blacklist:', error.message);
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

        const LoggerButton = document.createElement('button');

        function initializeLoggerButton() {

            LoggerButton.classList.add('hide-phone');
            LoggerButton.id = 'Log-on-off';
            LoggerButton.setAttribute('aria-label', 'LOGGER');
            LoggerButton.setAttribute('data-tooltip', 'RDS-LOGGER on/off');
            LoggerButton.style.borderRadius = '0px';
            LoggerButton.style.width = '100px';
            LoggerButton.style.position = 'relative';
            LoggerButton.style.marginTop = '16px';
            LoggerButton.style.right = '0px';
            LoggerButton.innerHTML = '<strong>RDS-LOGGER</strong>';
            LoggerButton.classList.add('bg-color-2');
            LoggerButton.title = `Plugin Version: ${plugin_version}`;

            const wrapperElement = document.querySelector('.tuner-info');
            if (wrapperElement) {
                const buttonWrapper = document.createElement('div');
                buttonWrapper.classList.add('button-wrapper');
                buttonWrapper.id = 'button-wrapper';
                buttonWrapper.appendChild(LoggerButton);
                wrapperElement.appendChild(buttonWrapper);
                const emptyLine = document.createElement('br');
                wrapperElement.appendChild(emptyLine);
            }

            LoggerButton.addEventListener('click', toggleLogger);
            displaySignalCanvas();
        }

        async function checkFileExists(url) {
            try {
                const response = await fetch(url, { method: 'GET' });
                return response.ok; // Returns true if the response status is 200-299
            } catch (error) {
                console.error('Error checking file existence:', error);
                return false;
            }
        }

        async function downloadDataCSV() {
            const now = new Date();
            const currentDate = formatDate(now);
            const currentTime = formatTime(now);
            const filename = `RDS-LOGGER_${currentDate}_${currentTime}.csv`;

            const filterState = getFilterStateFromCookie().state;
            const scannerState = getScannerStateFromCookie().state;

            if (scannerState) {
                const baseUrl = window.location.origin + '/logs/';

                // Parse the current date and calculate the previous date
                const currentDateFormatted = new Date(currentDate);
                const previousDateFormatted = new Date(currentDateFormatted);
                previousDateFormatted.setDate(currentDateFormatted.getDate() - 1);

                // Format dates as strings in the format YYYY-MM-DD
                const formattedCurrentDate = currentDateFormatted.toISOString().split('T')[0];
                const formattedPreviousDate = previousDateFormatted.toISOString().split('T')[0];

                // Create file names based on the presence of filterState
                const fileNameCurrent = filterState ? `SCANNER_${formattedCurrentDate}_filtered.csv` : `SCANNER_${formattedCurrentDate}.csv`;
                const fileNamePrevious = filterState ? `SCANNER_${formattedPreviousDate}_filtered.csv` : `SCANNER_${formattedPreviousDate}.csv`;

                // Construct URLs for both current and previous date files
                const fileUrlCurrent = baseUrl + fileNameCurrent;
                const fileUrlPrevious = baseUrl + fileNamePrevious;

                // Check if the file for the current date exists
                const fileExistsCurrent = await checkFileExists(fileUrlCurrent);
                if (fileExistsCurrent) {
                    window.open(fileUrlCurrent, '_blank');
                    return;
                } else {
                    // If the current date file doesn't exist, check for the previous date file
                    const fileExistsPrevious = await checkFileExists(fileUrlPrevious);
                    if (fileExistsPrevious) {
                        window.open(fileUrlPrevious, '_blank');
                        return;
                    } else {
                        // If neither file exists, alert the user
                        alert('File does not exist for current or previous date: ' + fileUrlCurrent + ' or ' + fileUrlPrevious);
                        return;
                    }
                }
            }

            // File does not exist, proceed to generate the CSV content
            try {
                // Initialize CSV data with headers and metadata
                let allData = `"${ServerName}"\n"${ServerDescription.replace(/\n/g, ". ")}"\n`;
                allData += filterState ? `RDS-LOGGER [FILTER MODE] ${currentDate} ${currentTime}\n\n` : `RDS-LOGGER ${currentDate} ${currentTime}\n\n`;

                allData += UTCtime
                    ? 'date;time(utc);freq;pi;ps;name;city;itu;pol;erp;dist;az;id\n'
                    : 'date;time;freq;pi;ps;name;city;itu;pol;erp;dist;az;id\n';

                // Determine which data array to use based on FilterState
                const dataToUse = filterState ? FilteredlogDataArray : logDataArray;

                // Process each line and append it to allData
                dataToUse.forEach(line => {
                    // Directly replace delimiters without conditional formatting
                    const formattedLine = line.replace(/\s*\|\s*/g, ";");
                    allData += formattedLine + '\n';
                });

                // Create a Blob from the CSV data
                const blob = new Blob([allData], { type: "text/csv" });

                // Handle download for different browsers
                if (window.navigator.msSaveOrOpenBlob) {
                    window.navigator.msSaveOrOpenBlob(blob, filename);
                } else {
                    const link = document.createElement("a");
                    link.href = window.URL.createObjectURL(blob);
                    link.download = filename;
                    document.body.appendChild(link); // Append to body to ensure compatibility
                    link.click();
                    document.body.removeChild(link); // Clean up
                    window.URL.revokeObjectURL(link.href);
                }
            } catch (error) {
                console.error('Error in downloadDataCSV:', error);
            }
        }

        // Cache for API responses
        const apiCache = {};

        async function checkFileExists(url) {
            try {
                const response = await fetch(url, { method: 'GET' });
                return response.ok; // Returns true if the response status is 200-299
            } catch (error) {
                console.error('Error checking file existence:', error);
                return false;
            }
        }

        async function downloadDataHTML() {
            const now = new Date();
            const currentDate = formatDate(now);
            const currentTime = formatTime(now);
            const filename = `RDS-LOGGER_${currentDate}_${currentTime}.html`;

            const filterState = getFilterStateFromCookie().state;
            const scannerState = getScannerStateFromCookie().state;

            if (scannerState) {
                const baseUrl = window.location.origin + '/logs/';
                const currentDateFormatted = new Date(currentDate);
                const previousDateFormatted = new Date(currentDateFormatted);
                previousDateFormatted.setDate(currentDateFormatted.getDate() - 1);

                const formattedCurrentDate = currentDateFormatted.toISOString().split('T')[0]; // Format as YYYY-MM-DD
                const formattedPreviousDate = previousDateFormatted.toISOString().split('T')[0]; // Format as YYYY-MM-DD

                const fileNameCurrent = filterState ? `SCANNER_${formattedCurrentDate}_filtered.html` : `SCANNER_${formattedCurrentDate}.html`;
                const fileNamePrevious = filterState ? `SCANNER_${formattedPreviousDate}_filtered.html` : `SCANNER_${formattedPreviousDate}.html`;

                const fileUrlCurrent = baseUrl + fileNameCurrent;
                const fileUrlPrevious = baseUrl + fileNamePrevious;

                const fileExistsCurrent = await checkFileExists(fileUrlCurrent);

                if (fileExistsCurrent) {
                    window.open(fileUrlCurrent, '_blank');
                    return;
                } else {
                    const fileExistsPrevious = await checkFileExists(fileUrlPrevious);
                    if (fileExistsPrevious) {
                        window.open(fileUrlPrevious, '_blank');
                        return;
                    } else {
                        alert('File not exist for current or previous date: ' + fileUrlCurrent + ' or ' + fileUrlPrevious);
                        return;
                    }
                }
            }

            let allData = htmlTemplate;

            allData += `${ServerName}<br>${ServerDescription}<br>`;
            allData += filterState
                ? `RDS-LOGGER [FILTER MODE] ${currentDate} ${currentTime}<br><br>`
                : `RDS-LOGGER ${currentDate} ${currentTime}<br><br>`;

            allData += UTCtime
                ? `<table border="1"><tr><th>DATE</th><th>TIME(UTC)</th><th>FREQ</th><th>PI</th><th>PS</th><th>NAME</th><th>CITY</th><th>ITU</th><th>P</th><th>ERP</th><th>DIST</th><th>AZ</th><th>ID</th><th>MAP</th><th>FMLIST</th></tr>`
                : `<table border="1"><tr><th>DATE</th><th>TIME</th><th>FREQ</th><th>PI</th><th>PS</th><th>NAME</th><th>CITY</th><th>ITU</th><th>P</th><th>ERP</th><th>DIST</th><th>AZ</th><th>ID</th><th>MAP</th><th>FMLIST</th></tr>`;

            // Use filteredLogDataArray if filter is active, otherwise use logDataArray
            const dataToUse = filterState ? FilteredlogDataArray : logDataArray;

            dataToUse.forEach(line => {
                if (typeof line !== 'string') {
                    console.error(`Invalid line found: ${line}`);
                    return; // Skip this iteration if line is not a string
                }

                let [date, time, freq, pi, ps, name, city, itu, pol, erpTxt, distance, azimuth, id] = line.split('|').map(value => value.trim());

                let link1 = id ? `<a href="https://maps.fmdx.org/#qth=${LAT},${LON}&id=${id}&findId=*" target="_blank">FMDX</a>` : '';
                let link2 = id && id > 0 && FMLIST_OM_ID !== '' ? `<a href="https://www.fmlist.org/fi_inslog.php?lfd=${id}&qrb=${distance}&qtf=${azimuth}&country=${itu}&omid=${FMLIST_OM_ID}" target="_blank">FMLIST</a>` : '';

                allData += `<tr><td>${date}</td><td>${time}</td><td>${freq}</td><td>${pi}</td><td>${ps}</td><td>${name}</td><td>${city}</td><td>${itu}</td><td>${pol}</td><td>${erpTxt}</td><td>${distance}</td><td>${azimuth}</td><td>${id}</td><td>${link1}</td><td>${link2}</td></tr>\n`;
            });

            allData += `</table></pre><pre></body></html>`;

            const blob = new Blob([allData], { type: "text/html" });

            if (window.navigator.msSaveOrOpenBlob) {
                window.navigator.msSaveOrOpenBlob(blob, filename);
            } else {
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.target = "_blank";
                link.click();
                window.URL.revokeObjectURL(url);
            }
        }

        function getCurrentUTC() {
            // Get the current time in UTC
            const now = new Date();

            // Extract the UTC hours, minutes, and seconds
            const hours = String(now.getUTCHours()).padStart(2, '0');
            const minutes = String(now.getUTCMinutes()).padStart(2, '0');
            const seconds = String(now.getUTCSeconds()).padStart(2, '0');

            // Format the time in HH:MM:SS format
            const utcTime = `${hours}:${minutes}:${seconds}`;

            return utcTime;
        }
			
		// Initialize on start
		initializeLoggerButton();
		setupBlacklistButton();
		checkBlacklist();
		delay(1000).then(() => {
			setupWebSocket();
		});

    })();
}

 // Function to check if the user is logged in as an administrator
    function checkAdminMode() {
        const bodyText = document.body.textContent || document.body.innerText;
        const AdminLoggedIn = bodyText.includes("You are logged in as an administrator.") || bodyText.includes("You are logged in as an adminstrator.");
 
        if (AdminLoggedIn) {
            console.log(`Admin mode found`);
            isTuneAuthenticated = true;
        } 
    }
	    checkAdminMode(); // Check admin mode

  	setTimeout(() => {

	// Execute the plugin version check if updateInfo is true and admin ist logged on
	if (updateInfo && isTuneAuthenticated) {
		checkPluginVersion();
		}
	}, 200);

})();
			
const htmlTemplate = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>RDS-LOGGER</title>
    <style>
        /* Unified font style for the entire document */
        body, label {
            font-family: Arial, sans-serif;
            font-size: 14px;
        }

        /* Container for the search and refresh controls */
        #controls {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
            width: 100%;
            box-sizing: border-box;
        }

        /* Flexible area for the search input */
        #searchContainer {
            flex: 1;
            display: flex;
            align-items: center;
        }

        /* Styling for the search input */
        #searchInput {
            padding: 5px;
            width: 100%;
            max-width: 300px;
            min-width: 100px; /* Ensures a minimum width */
            box-sizing: border-box;
            margin-right: 10px;
        }

        /* Styling for the custom distance input */
        #freeDistanceInput {
            height: 14px; 
            width: 50px; 
        }
        
        .distance-label {
            position: relative;
            top: 3px; /* Moves the 'km' label 5 pixels down */
        }

        /* Container for the distance filter checkboxes */
        #filterContainer {
            display: flex;
            gap: 10px;
        }

        /* Container for the buttons */
        #buttonContainer {
            display: flex;
            align-items: center;
        }

        /* Styling for the buttons */
        .button {
            padding: 10px 20px;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            color: white;
            margin-left: 10px; /* Space between buttons */
        }

        /* Styling for the dark mode button */
        #darkModeButton {
            background-color: #6c757d;
        }

        /* Dark mode styling */
        body.dark-mode {
            background-color: #121212;
            color: white;
        }

        body.dark-mode table {
            color: white;
        }

        body.dark-mode th {
            background-color: #1f1f1f;
        }

        body.dark-mode td {
            border-color: #333;
        }

        /* Make table headers clickable */
        th {
            cursor: pointer;
        }

        /* Table styling */
        table {
            width: 100%;
            border-collapse: collapse;
            table-layout: auto; /* Ensure columns are auto-sized */
        }

        /* Styling for table cells */
        th, td {
            padding: 3px;
            text-align: left;
            white-space: nowrap; /* Prevents text from wrapping */
        }

        /* Background color for table headers */
        th {
            background-color: #f2f2f2;
        }

        /* Dark mode styling for links */
        body.dark-mode a {
            color: #d6a8f5; /* Light purple color */
        }

        body.dark-mode a:hover {
            color: #b57edc; /* Slightly darker purple for hover effect */
        }

        /* Dark mode styling for the search input */
        body.dark-mode #searchInput {
            background-color: #6c757d; /* Match the color of the dark mode toggle button */
            color: white; /* Ensure text is readable */
        }

        /* Dark mode styling for the search input placeholder */
        body.dark-mode #searchInput::placeholder {
            color: white; /* Light gray placeholder text for better readability */
        }  
    </style>
    <script>
    let baseUrl = ""; // Variable to store the dynamic base URL

    /* Get the value of a cookie by name */
    function getCookie(name) {
        const cookieName = name + "=";
        const cookies = decodeURIComponent(document.cookie).split(';');
        for (let i = 0; i < cookies.length; i++) {
            let cookie = cookies[i];
            while (cookie.charAt(0) === ' ') {
                cookie = cookie.substring(1);
            }
            if (cookie.indexOf(cookieName) === 0) {
                return cookie.substring(cookieName.length, cookie.length);
            }
        }
        return "";
    }

    /* Set a cookie with a specific name, value, and expiration (in days) */
    function setCookie(name, value, days) {
        const expires = "expires=" + new Date(Date.now() + days * 864e5).toUTCString();
        document.cookie = name + "=" + value + ";" + expires + ";path=/";
    }

    /* Extracts the base URL from the first entry */
    function extractBaseUrl() {
        // Get all anchor elements within the table
        const links = document.querySelectorAll("table tr td a");
    
        // Loop through each link
        for (let i = 0; i < links.length; i++) {
            const href = links[i].href;

            // Check if the href contains "https://maps.fmdx.org"
            if (href.includes("https://maps.fmdx.org")) {
                // Extract the base part up to '&id='
                const splitLink = href.split('&id=')[0];
                // Add the '&id=' back to form the correct base URL
                baseUrl = splitLink + "&id=";
                break; // Exit the loop once we find the first matching link
            }
        }
    }

    /* Sorts the table based on column index (n) */
    function sortTable(n, isNumeric = false) {
        const table = document.querySelector("table");
        let rows, switching, i, x, y, shouldSwitch, dir, switchcount = 0;
        switching = true;
        dir = "asc";

        /* Keep switching rows until sorting is complete */
        while (switching) {
            switching = false;
            rows = table.rows;

            /* Loop through the rows, skipping the header */
            for (i = 1; i < (rows.length - 1); i++) {
                shouldSwitch = false;
                x = rows[i].getElementsByTagName("TD")[n];
                y = rows[i + 1].getElementsByTagName("TD")[n];

                /* Compare based on numeric or string content */
                let xContent = isNumeric ? parseFloat(x.innerHTML) || 0 : x.innerHTML.toLowerCase();
                let yContent = isNumeric ? parseFloat(y.innerHTML) || 0 : y.innerHTML.toLowerCase();

                /* Determine if a switch is needed based on direction */
                if (dir == "asc") {
                    if (xContent > yContent) {
                        shouldSwitch = true;
                        break;
                    }
                } else if (dir == "desc") {
                    if (xContent < yContent) {
                        shouldSwitch = true;
                        break;
                    }
                }
            }
            if (shouldSwitch) {
                /* Make the switch and mark switching as true */
                rows[i].parentNode.insertBefore(rows[i + 1], rows[i]);
                switching = true;
                switchcount++;
            } else {
                /* If no switching happened, change the direction */
                if (switchcount == 0 && dir == "asc") {
                    dir = "desc";
                    switching = true;
                }
            }
        }
    }

    /* Filter table based on user input and distance */
    function filterTable() {
        const input = document.getElementById("searchInput");
        const filter = input.value.toLowerCase();
        const table = document.querySelector("table");
        const tr = table.getElementsByTagName("tr");
		
		// Get the PI codes from the new input field
        const piCodesInput = document.getElementById("piCodesInput").value;
		piCodesArray = piCodesInput.split(',')
			.map(code => code && typeof code === 'string' ? code.trim().split('?').join('') : '') // Remove trailing question marks
			.filter(code => code); // Trim and filter empty codes

        // Checkbox filter
        const filter150 = document.getElementById("filter150").checked;
        const filter300 = document.getElementById("filter300").checked;
        const filter700 = document.getElementById("filter700").checked;
        const filter1300 = document.getElementById("filter1300").checked;
        const filterFreeDistance = document.getElementById("filterFreeDistance").checked;
        const freeDistanceInput = parseFloat(document.getElementById("freeDistanceInput").value);

        let distanceFilter = null; // Start with no distance filter

        if (filter150) {
            distanceFilter = 150;
        } else if (filter300) {
            distanceFilter = 300;
        } else if (filter700) {
            distanceFilter = 700;
        } else if (filter1300) {
            distanceFilter = 1300;
        } else if (filterFreeDistance && !isNaN(freeDistanceInput)) {
            distanceFilter = freeDistanceInput; // Use custom distance if checkbox is checked and value is valid
        }

        // Loop through all table rows
        for (let i = 1; i < tr.length; i++) {
            let td = tr[i].getElementsByTagName("td");
            let display = true; // Start assuming the row should be displayed

            // Filter based on search input
            if (filter) {
                let rowMatches = false; // Assume no match initially
                for (let j = 0; j < td.length; j++) {
                    if (td[j].textContent.toLowerCase().indexOf(filter) > -1) {
                        rowMatches = true; // Set match to true if any cell matches
                        break;
                    }
                }
                if (!rowMatches) {
                    display = false; // If no cells matched the filter, hide the row
                }
            }

			// Filter based on PI codes
			if (display && piCodesArray.length > 0) {
				const piCodeValue = td[3].textContent.trim().split('?').join(''); // Remove all question marks
				if (piCodesArray.includes(piCodeValue)) {
					display = false; // Hide the row if the PI code is in the exclusion list
				}
			}	

            // Show or hide the row based on the filters
            tr[i].style.display = display ? "" : "none";
        }

        generateDynamicLink(); // Update the link after filtering
    }

    /* Toggle Dark Mode */
    function toggleDarkMode() {
        const body = document.body;
        const isDarkMode = body.classList.toggle("dark-mode");
        setCookie("darkMode", isDarkMode, 365); // Save preference for 1 year
    }

    /* Apply Dark Mode based on cookie */
    function applyDarkMode() {
        const darkMode = getCookie("darkMode");
        if (darkMode === "true") {
            document.body.classList.add("dark-mode");
        }
    }

    /* Generates a dynamic link based on visible table rows */
    function generateDynamicLink() {
        const table = document.querySelector("table");
        const rows = table.getElementsByTagName("tr");
        const uniqueIds = new Set();

        // Loop through table rows to collect IDs
        for (let i = 1; i < rows.length; i++) {
            if (rows[i].style.display !== "none") { // Only consider visible rows
                const cells = rows[i].getElementsByTagName("td");
                const idCell = cells[cells.length - 3]; // The ID cell (3rd last cell)
                if (idCell) {
                    const idValue = idCell.textContent.trim();
                    if (idValue) {
                        uniqueIds.add(idValue);
                    }
                }
            }
        }

        // Check if IDs were found
        if (uniqueIds.size > 0) {
            const idsString = Array.from(uniqueIds).join(",");
            const dynamicLink = baseUrl + idsString + "&findId=*"; // Use dynamic base URL

            // Create or update link element
            let dynamicLinkElement = document.getElementById("dynamicLink");
            if (!dynamicLinkElement) {
                dynamicLinkElement = document.createElement("a");
                dynamicLinkElement.id = "dynamicLink";
                dynamicLinkElement.target = "_blank";
                document.body.appendChild(document.createElement("pre")).appendChild(dynamicLinkElement);
            }
            dynamicLinkElement.href = dynamicLink;
            dynamicLinkElement.textContent = "MAP ALL";
        }
    }

    /* Initializes controls on DOMContentLoaded */
    document.addEventListener('DOMContentLoaded', () => {
        applyDarkMode(); // Apply Dark Mode preference
        extractBaseUrl(); // Extract base URL from the first entry

        const controlsContainer = document.createElement('div');
        controlsContainer.id = 'controls';

        /* Create and append the search input container */
        const searchContainer = document.createElement('div');
        searchContainer.id = 'searchContainer';

        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.id = 'searchInput';
        searchInput.placeholder = 'Search table ...';
        searchInput.onkeyup = filterTable;
        searchContainer.appendChild(searchInput);

        /* Create and append the distance filter container */
        const filterContainer = document.createElement('div');
        filterContainer.id = 'filterContainer';

        filterContainer.innerHTML = '<label><input type="checkbox" id="filter150" onchange="filterTable()"> ≥ 150 km</label>' +
            '<label><input type="checkbox" id="filter300" onchange="filterTable()"> ≥ 300 km</label>' +
            '<label><input type="checkbox" id="filter700" onchange="filterTable()"> ≥ 700 km</label>' +
            '<label><input type="checkbox" id="filter1300" onchange="filterTable()"> ≥ 1300 km</label>' +
            '<label>' +
                '<input type="checkbox" id="filterFreeDistance" onchange="filterTable()"> Custom:' +
            '</label>' +
            '<input type="number" id="freeDistanceInput" placeholder="" min="0" oninput="filterTable()">' +
            '<span class="distance-label">km</span>' + 
			'<label for="piCodesInput" style="margin-top: 3px; display: block;">Exclude PI Codes (comma separated):</label>' +
			'<input type="text" id="piCodesInput" placeholder="e.g. 6201,6202,6203" oninput="filterTable()">';

        searchContainer.appendChild(filterContainer);
        controlsContainer.appendChild(searchContainer);

        /* Create and append the button container */
        const buttonContainer = document.createElement('div');
        buttonContainer.id = 'buttonContainer';

        /* Create and append the dark mode button */
        const darkModeButton = document.createElement('button');
        darkModeButton.id = 'darkModeButton';
        darkModeButton.className = 'button';
        darkModeButton.innerText = 'Toggle Dark Mode';
        darkModeButton.addEventListener('click', toggleDarkMode);
        buttonContainer.appendChild(darkModeButton);

        /* Append the button container to the controls container */
        controlsContainer.appendChild(buttonContainer);

        /* Insert controls above the table */
        document.body.insertBefore(controlsContainer, document.querySelector("pre"));

        /* Add click event listeners to table headers for sorting */
        const headers = document.querySelectorAll("th");
        headers[1].addEventListener("click", () => sortTable(1)); // TIME(UTC)
        headers[2].addEventListener("click", () => sortTable(2, true)); // FREQ
        headers[3].addEventListener("click", () => sortTable(3)); // PI
        headers[4].addEventListener("click", () => sortTable(4)); // PS
        headers[5].addEventListener("click", () => sortTable(5)); // NAME
        headers[6].addEventListener("click", () => sortTable(6)); // CITY
        headers[7].addEventListener("click", () => sortTable(7)); // ITU
        headers[8].addEventListener("click", () => sortTable(8)); // P
        headers[9].addEventListener("click", () => sortTable(9, true)); // ERP
        headers[10].addEventListener("click", () => sortTable(10, true)); // DIST
        headers[11].addEventListener("click", () => sortTable(11, true)); // AZ
        headers[12].addEventListener("click", () => sortTable(12)); // ID

        // Event listeners to ensure only one checkbox is selected
        document.querySelectorAll('#filterContainer input[type="checkbox"]').forEach((checkbox) => {
            checkbox.addEventListener('change', function () {
                if (this.checked) {
                    document.querySelectorAll('#filterContainer input[type="checkbox"]').forEach((cb) => {
                        if (cb !== this) cb.checked = false;
                    });
                }
                filterTable(); // Update the table after changing a checkbox
            });
        });

        generateDynamicLink();
    });
    </script>
</head>
<body>
<pre></pre>
</body>
</html>
`;
