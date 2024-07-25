////////////////////////////////////////////////////////////
///                                                      ///
///  RDS-LOGGER SCRIPT FOR FM-DX-WEBSERVER (V1.3i)       ///
///                                                      ///
///  by Highpoint                last update: 25.07.24   ///
///                                                      ///
///  https://github.com/Highpoint2000/webserver-logger   ///
///                                                      ///
////////////////////////////////////////////////////////////

///  This plugin only works from web server version 1.2.3!!!

const FMLIST_OM_ID = ''; // To use the logbook function, please enter your OM ID here, for example: FMLIST_OM_ID = '1234'
const Screen = ''; // If you see unsightly horizontal scroll bars, set this value to 'small' or 'ultrasmall'
const TestMode = 'false'; // 'false' is only for testing
const plugin_version = 'V1.3i'; // Plugin Version

/////////////////////////////////////////////////////////////////////////////////////

let test_frequency = '';
let test_picode = '';        
let test_itu = '';           
let test_city = '';    
let test_ps = '';      
let test_station = ''; 
let test_pol = '';             
let test_erp = '';             
let test_distance = '';      
let test_azimuth = '';   

// CSS Styles for buttonWrapper
const buttonWrapperStyles = `
      display: flex;
      justify-content: left;
      align-items: center;
      margin-top: 0px;
`;     

if (TestMode === 'true') {
    console.log('Test mode enabled');
    // These variables are only assigned if TestMode is 'true'
    test_frequency = '90.300';  // Test Frequency
    test_picode = '7261';       // Test Picode
    test_itu = 'RUS';           // Test ITU code
    test_city = 'Moskva';       // Test city
    test_ps = '*_ABTO_*';       // Test PS (Program Service name)
    test_station = 'Avtoradio'; // Test station name
    test_pol = 'C';             // Test polarization
    test_erp = '160';           // Test ERP (Effective Radiated Power)
    test_distance = '1416';     // Test distance
    test_azimuth = '33';        // Test azimuth
}

// Immediately invoked function expression (IIFE) to encapsulate the loggerPlugin code
(() => {
	
    const loggerPlugin = (() => {

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
        let SaveFrequency = '';
        let Savepicode = '';
        let Savestation = '';

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
        loggingCanvas.style.width = "96.0%";
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
        //console.log(loggingCanvasWidth);

        // Create and configure title div
        const titleDiv = document.createElement("div");

        if (Screen === 'ultrasmall') {
            titleDiv.innerHTML = "<h2 style='margin-top: 0px; font-size: 16px;'><strong>DATE        TIME       FREQ    PI       PS         NAME                 CITY             ITU POL    ERP  DIST   AZ</strong></h2>";
        } else if (Screen === 'small') {
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

        let downloadButtonsContainer = document.querySelector(".download-buttons-container");

        if (!downloadButtonsContainer) {
            downloadButtonsContainer = document.createElement("div");
            downloadButtonsContainer.className = "download-buttons-container";
            downloadButtonsContainer.style.display = "none";
            downloadButtonsContainer.style.position = "relative";
            downloadButtonsContainer.style.marginLeft = "76.5%";
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
			FMDXButton.style.marginRight = "-152%";
			FMDXButton.style.marginLeft = "-25px";
			FMDXButton.style.display = "flex";
			FMDXButton.style.alignItems = "center";
			FMDXButton.style.justifyContent = "center";
			FMDXButton.style.borderRadius = '0px';

			// Function to update the button's class based on station
			function updateFMDXButtonClass() {
				const data = previousDataByFrequency[currentFrequency];
				const station = data ? data.station : '';
        
			if (station === '') {
					FMDXButton.classList.remove('bg-color-4');
					FMDXButton.classList.add('bg-color-2');
					FMDXButton.classList.remove('active'); 
					FMDXButton.classList.add('inactive'); 
					FMDXButton.disabled = true;
				} else {
					FMDXButton.classList.remove('bg-color-2');
					FMDXButton.classList.add('bg-color-4');
					FMDXButton.classList.remove('inactive'); 
					FMDXButton.classList.add('active'); 
					FMDXButton.disabled = false;
				}
			}

			// Event listener for button click
			FMDXButton.addEventListener("click", function () {
				const data = previousDataByFrequency[currentFrequency];
				const station = data ? data.station : '';
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
				}
			});

			// Set an interval to continually check and update the button's class
			setInterval(updateFMDXButtonClass, 100); // Check every 100 millisecond

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
			// Create a container for the button or placeholder
			const container = document.createElement("div");
			container.style.width = "80px";
			container.style.height = "20px";
			container.style.marginRight = "-140px";
			container.style.marginLeft = "-20px";
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

					if (station !== '' && FMLIST_OM_ID) {
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

				// Eventlistener for button click
				FMLISTButton.addEventListener("click", function () {
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
                id = '';
            }
            
            const now = new Date();
            const date = formatDate(now);
            const time = formatTime(now);
            const currentFrequencyWithSpaces = padLeftWithSpaces(currentFrequency, 7);
            const data = previousDataByFrequency[currentFrequency];

            const loggingCanvasWidth = parentContainer.getBoundingClientRect().width;

            if ((data && data.picode.length > 1 && TestMode !== 'true') || (TestMode === 'true' && currentFrequency === test_frequency)) {
                
                let station = "";
                let city = "";
                let itu = "";
                let pol = "";
                let erpTxt = "";
                let distance = "";
                let azimuth = "";
                let picode = "";
                let ps = "";
                    
       if (TestMode === 'true' && currentFrequency === test_frequency) {   
       
            station = Screen === 'ultrasmall'
            ? truncateString(padRightWithSpaces(test_station, 19), 19)
            : Screen === 'small'
                ? truncateString(padRightWithSpaces(test_station, 23), 23)
                : truncateString(padRightWithSpaces(test_station, 25), 25);               
            city = Screen === 'ultrasmall'
            ? truncateString(padRightWithSpaces(test_city, 15), 15)
            : Screen === 'small'
                ? truncateString(padRightWithSpaces(test_city, 19), 19)
                : truncateString(padRightWithSpaces(test_city, 21), 21);
            itu = truncateString(padLeftWithSpaces(test_itu, 3), 3);
            pol = truncateString(test_pol, 1);
            erpTxt = truncateString(padLeftWithSpaces(String(test_erp), 6), 6);
            distance = truncateString(padLeftWithSpaces(test_distance, 4), 4);
            azimuth = truncateString(padLeftWithSpaces(test_azimuth, 3), 3);
            picode = truncateString(padRightWithSpaces(test_picode, 7), 7);
            ps = truncateString(padRightWithSpaces(test_ps.replace(/ /g, "_"), 9), 9);
        } else {
            station = Screen === 'ultrasmall'
            ? truncateString(padRightWithSpaces(data.station, 19), 19)
            : Screen === 'small'
                ? truncateString(padRightWithSpaces(data.station, 23), 23)
                : truncateString(padRightWithSpaces(data.station, 25), 25);               
            city = Screen === 'ultrasmall'
            ? truncateString(padRightWithSpaces(data.city, 15), 15)
            : Screen === 'small'
                ? truncateString(padRightWithSpaces(data.city, 19), 19)
                : truncateString(padRightWithSpaces(data.city, 21), 21);
            itu = truncateString(padLeftWithSpaces(data.itu, 3), 3);
            pol = truncateString(data.pol, 1);
            erpTxt = truncateString(padLeftWithSpaces(String(data.erp), 6), 6);
            distance = truncateString(padLeftWithSpaces(data.distance, 4), 4);
            azimuth = truncateString(padLeftWithSpaces(data.azimuth, 3), 3);
            picode = truncateString(padRightWithSpaces(data.picode, 7), 7);
            ps = truncateString(padRightWithSpaces(data.ps.replace(/ /g, "_"), 9), 9);

        }
                const outputText = station 
                    ? `${date}  ${time}  ${currentFrequencyWithSpaces}  ${picode}  ${ps}  ${station}  ${city}  ${itu}  ${pol}  ${erpTxt}  ${distance}  ${azimuth}`
                    : `${date}  ${time}  ${currentFrequencyWithSpaces}  ${picode}  ${ps}`;

                let outputArray = station 
                    ? `${date} | ${time} | ${currentFrequencyWithSpaces} | ${picode} | ${ps} | ${station} | ${city} | ${itu} | ${pol} | ${erpTxt} | ${distance} | ${azimuth}`
                    : `${date} | ${time} | ${currentFrequencyWithSpaces} | ${picode} | ${ps} |                           |                       |     |   |        |      |    `;

                if (!blacklist.length || !isInBlacklist(currentFrequency, blacklist)) {
                      if (data.station && loopCounter === 0) {

                            if (TestMode === 'true' && currentFrequency === test_frequency) {   
                                id = await getidValue(currentFrequency, test_picode, test_itu, test_city);
                            } else {
                                id = await getidValue(currentFrequency, data.picode, data.itu, data.city);
                            }
                                if (id === undefined) {
                                let id = '';
                            }
                            if (id && !idAll.split(',').includes(id)) {
                                idAll += idAll ? `,${id}` : id;
                            }
                            
                            loopCounter = 1;
                    }
                                
                    if ((NewLine === 'true') || (SaveFrequency === currentFrequencyWithSpaces.replace(/\s/g, '') && Savestation !== station && station !== '' && Savepicode !== picode.replace(/[?\s]/g, '') && NewLine !== 'true')) {

                        const newOutputDiv = document.createElement("div");
                        newOutputDiv.style.whiteSpace = "pre-wrap";
                        newOutputDiv.style.fontSize = "16px";
                        newOutputDiv.style.marginBottom = "-1px";
                        newOutputDiv.style.padding = "0 10px";
                        if (dataCanvas instanceof Node) {
                            dataCanvas.appendChild(newOutputDiv);
                        }
                        logDataArray.push(newOutputDiv);    
                        scrollCounter = 0;                
                        NewLine = 'false'; 
                        SaveFrequency = currentFrequencyWithSpaces.replace(/\s/g, '');
                        Savepicode = picode.replace(/[?\s]/g, '');
                        Savestation = station;
                        
                    } else {
                        
                        if (dataCanvas && dataCanvas.lastChild) {                                                                   
                            if (FilterState) { 
                                if (!data.picode.includes('?') && data.station) {                                
                                    const lastOutputDiv = dataCanvas.lastChild;
                                    lastOutputDiv.textContent = outputText;   
                                    if (scrollCounter === 0) {
                                        dataCanvas.scrollTop = dataCanvas.scrollHeight - dataCanvas.clientHeight;
                                        scrollCounter = 1;
                                    }   
                                    if (id === '') {  
                                        loopCounter = 0;
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
                                if (id === '') {  
                                    loopCounter = 0;
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
			if (typeof CanvasRotator !== 'undefined' && CanvasRotator) {
				CanvasRotator.style.display = 'none';
			}
			if (typeof backgroundRotator !== 'undefined' && backgroundRotator) {
				backgroundRotator.style.display = 'none';
			}
			const signalCanvas = document.getElementById('signal-canvas');
			if (signalCanvas) {
				signalCanvas.style.display = 'block';
			}
			if (typeof CanvasRotator !== 'undefined' && CanvasRotator) {
				CanvasRotator.style.display = 'block';
			}
			if (typeof backgroundRotator !== 'undefined' && backgroundRotator) {
			backgroundRotator.style.display = 'block';
			}
		}

		// Display signal output
		function displaySignalOutput() {
			const loggingCanvas = document.getElementById('logging-canvas');
			if (loggingCanvas) {
				loggingCanvas.style.display = 'block';
			}
			if (typeof CanvasRotator !== 'undefined' && CanvasRotator) {
				CanvasRotator.style.display = 'block';
			}
			if (typeof backgroundRotator !== 'undefined' && backgroundRotator) {
				backgroundRotator.style.display = 'block';
			}
			const signalCanvas = document.getElementById('signal-canvas');
			if (signalCanvas) {
				signalCanvas.style.display = 'none';
			}
			if (typeof CanvasRotator !== 'undefined' && CanvasRotator) {
				CanvasRotator.style.display = 'none';
			}
			if (typeof backgroundRotator !== 'undefined' && backgroundRotator) {
				backgroundRotator.style.display = 'none';
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

		const LoggerButton = document.createElement('button');

		function initializeLoggerButton() {
			//console.log('initializeLoggerButton wird aufgerufen'); // Debugging-Output

			setupWebSocket();

			LoggerButton.classList.add('hide-phone');
			LoggerButton.id = 'Log-on-off';
			LoggerButton.setAttribute('aria-label', 'Scan');
			LoggerButton.setAttribute('data-tooltip', 'Auto Scan on/off');
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
            const FilterState = getFilterStateFromCookie().state;

            const filename = `RDS-LOGGER_${currentDate}_${currentTime}.csv`;

            let allData;
            let sortedLogDataArray = [...logDataArray];

            try {
                // Sort the entire array by frequency
                sortedLogDataArray.sort((a, b) => {
                    const freqA = parseFloat(a.split('|')[2]?.trim());
                    const freqB = parseFloat(b.split('|')[2]?.trim());
                    return freqA - freqB;
                });

                if (FilterState) {
                    allData = `"${ServerName}"\n"${ServerDescription.replace(/\n/g, ". ")}"\nRDS-LOGGER [FILTER MODE] ${currentDate} ${currentTime}\n\nfreq;pi;ps;name;city;itu;pol;erp;dist;az;id;date;time\n`;

                    // Filter the log data to remove duplicates
                    let previousRecord = null;
                    const filteredLogDataArray = [];

                    sortedLogDataArray.forEach(line => {
                        const parts = line.split('|');
                        if (parts.length < 4) {
                            console.error('Invalid line format:', line);
                            return;
                        }

                        const [date, time, freq, pi, ps, name, city, ...rest] = parts.map(value => value.trim());
                        const cleanedPi = pi.replace('?', '');

                        if (previousRecord) {
                            const [prevFreq, prevPi, prevName, prevCity] = previousRecord;

                            if (freq === prevFreq && cleanedPi === prevPi) {
                                if (name === prevName && city === prevCity) {
                                    return;
                                } else if (prevName === "" && prevCity === "") {
                                    previousRecord = [freq, cleanedPi, name, city];
                                    filteredLogDataArray[filteredLogDataArray.length - 1] = `${date}|${time}|${freq}|${pi}|${ps}|${name}|${city}|${rest.join('|')}`;
                                    return;
                                } else {
                                    return;
                                }
                            }
                        }

                        previousRecord = [freq, cleanedPi, name, city];
                        filteredLogDataArray.push(line);
                    });

                    sortedLogDataArray = filteredLogDataArray;
                } else {
                    allData = `"${ServerName}"\n"${ServerDescription.replace(/\n/g, ". ")}"\nRDS-LOGGER ${currentDate} ${currentTime}\n\ndate;time;freq;pi;ps;name;city;itu;pol;erp;dist;az;id\n`;
                }

                allData += sortedLogDataArray.map(line => {
                    const parts = line.split('|');
                    const [date, time, ...rest] = parts.map(value => value.trim());
                    return FilterState ? `${rest.join(';')};${date};${time}` : line.replaceAll(/\s*\|\s*/g, ";");
                }).join('\n');

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
            } catch (error) {
                console.error('Error in downloadDataCSV:', error);
            }
        }


        // Cache for API responses
        const apiCache = {};

        async function downloadDataHTML() {
            const now = new Date();
            const currentDate = formatDate(now);
            const currentTime = formatTime(now);
            const filename = `RDS-LOGGER_${currentDate}_${currentTime}.html`;

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
                // Sort the array by frequency first
                sortedLogDataArray.sort((a, b) => {
                    // Check if a and b are valid strings before splitting
                    if (typeof a !== 'string' || typeof b !== 'string') {
                        return 0; // No change in order if a or b is not a string
                    }

                    const partsA = a.split('|');
                    const partsB = b.split('|');

                    if (partsA.length < 4 || partsB.length < 4) {
                        return 0; // No change in order if split doesn't produce expected parts
                    }

                    const [dateA, timeA, freqA, piA] = partsA.map((value, index) => index === 2 ? parseFloat(value.trim()) : value.trim().replace('?', ''));
                    const [dateB, timeB, freqB, piB] = partsB.map((value, index) => index === 2 ? parseFloat(value.trim()) : value.trim().replace('?', ''));

                    return freqA - freqB;
                });

                // Filter duplicates based on frequency and PI
                let previousRecord = null;
                const filteredLogDataArray = [];

                sortedLogDataArray.forEach(line => {
                    if (typeof line !== 'string') {
                        console.error(`Invalid line found: ${line}`);
                        return; // Skip this iteration if line is not a string
                    }

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

                // Assign filtered array back to sortedLogDataArray
                sortedLogDataArray = filteredLogDataArray;
            }

            sortedLogDataArray.forEach(line => {
                if (typeof line !== 'string') {
                    console.error(`Invalid line found: ${line}`);
                    return; // Skip this iteration if line is not a string
                }

                let [date, time, freq, pi, ps, name, city, itu, pol, erpTxt, distance, azimuth, id] = line.split('|').map(value => value.trim());

                let link1 = id !== '' ? `<a href="https://maps.fmdx.pl/#qth=${LAT},${LON}&id=${id}&findId=*" target="_blank">FMDX</a>` : '';
                let link2 = id !== '' ? `<a href="https://www.fmlist.org/fi_inslog.php?lfd=${id}&qrb=${distance}&qtf=${azimuth}&country=${itu}&omid=${FMLIST_OM_ID}" target="_blank">FMLIST</a>` : '';

                if (filterState) {
                    allData += `<tr><td>${freq}</td><td>${pi}</td><td>${ps}</td><td>${name}</td><td>${city}</td><td>${itu}</td><td>${pol}</td><td>${erpTxt}</td><td>${distance}</td><td>${azimuth}</td><td>${id}</td><td>${date}</td><td>${time}</td><td>${link1}</td><td>${link2}</td></tr>\n`;
                } else {
                    allData += `<tr><td>${date}</td><td>${time}</td><td>${freq}</td><td>${pi}</td><td>${ps}</td><td>${name}</td><td>${city}</td><td>${itu}</td><td>${pol}</td><td>${erpTxt}</td><td>${distance}</td><td>${azimuth}</td><td>${id}</td><td>${link1}</td><td>${link2}</td></tr>\n`;
                }
            });

            let finalLink = `https://maps.fmdx.pl/#qth=${LAT},${LON}&id=${idAll}&findId=*`;
            allData += `</table></pre><pre><a href="${finalLink}" target="_blank">FMDX ALL</a></body></html>`;

            const blob = new Blob([allData], { type: "text/html" });

            if (window.navigator.msSaveOrOpenBlob) {
                // For IE browser
                window.navigator.msSaveOrOpenBlob(blob, filename);
            } else {
                // For other browsers
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
                const corsAnywhereUrl = 'https://cors-proxy.highpoint2000.synology.me:5001/';
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
