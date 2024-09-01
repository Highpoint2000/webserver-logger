////////////////////////////////////////////////////////////
///                                                      ///
///  RDS-LOGGER SCRIPT FOR FM-DX-WEBSERVER (V1.6 BETA)   ///
///                                                      ///
///  by Highpoint                last update: 31.08.24   ///
///                                                      ///
///  https://github.com/Highpoint2000/webserver-logger   ///
///                                                      ///
////////////////////////////////////////////////////////////

///  This plugin only works from web server version 1.2.6!!!

const FMLIST_OM_ID = ''; 	// To use the logbook function, please enter your OM ID here, for example: FMLIST_OM_ID = '1234'
const Screen = ''; 				// If you see unsightly horizontal scroll bars, set this value to 'small' or 'ultrasmall'
const ScannerButtonView = true; // Set to 'true' to get a button that activates the download links to the scanner files
const UTCtime = true; 			// Set to "true" for logging with UTC Time

const TestMode = false; 				// Standard is 'false' - only for testings!!!
const plugin_version = 'V1.6 BETA'; 	// Plugin Version

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
let test_stationid = '';   

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
	test_stationid = 'xxxxxx';  // Test stationid
}

// Immediately invoked function expression (IIFE) to encapsulate the loggerPlugin code
(() => {
	
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
			// console.log(eventData);
            const frequency = eventData.freq;

            // Process data if frequency is not in the blacklist
            const txInfo = eventData.txInfo;
			//console.log(txInfo);

            let ps = eventData.ps;
            if ((eventData.ps_errors !== "0,0,0,0,0,0,0,1") && (eventData.ps_errors !== "0,0,0,0,0,0,0,0")) {
                ps += "?";
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
        //console.log(loggingCanvasWidth);

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
			
			const FMDXButton = createFMDXButton();
            if (FMDXButton instanceof Node) {
                ButtonsContainer.appendChild(FMDXButton);
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
		

		// Function to create the FMDX button and link it to the overlay
		function createFMDXButton() {
			// Create the button
			const FMDXButton = document.createElement("button");
			FMDXButton.textContent = "FMDX";
			FMDXButton.style.width = "80px";
			FMDXButton.style.height = "20px";
			FMDXButton.style.marginLeft = "140px";
			FMDXButton.style.display = "flex";
			FMDXButton.style.alignItems = "center";
			FMDXButton.style.justifyContent = "center";
			FMDXButton.style.borderRadius = '0px';

			// Function to update the button's class based on station
			function updateFMDXButtonClass() {
				const data = previousDataByFrequency[currentFrequency];
				const station = data ? data.station : '';
				stationid = data ? data.stationid : '';
        
			if (station !== '' && !isInBlacklist(currentFrequency, blacklist)) {
					FMDXButton.classList.remove('bg-color-2');
					FMDXButton.classList.add('bg-color-4');
					FMDXButton.classList.remove('inactive'); 
					FMDXButton.classList.add('active'); 
					FMDXButton.disabled = false;
				} else {
					FMDXButton.classList.remove('bg-color-4');
					FMDXButton.classList.add('bg-color-2');
					FMDXButton.classList.remove('active'); 
					FMDXButton.classList.add('inactive'); 
					FMDXButton.disabled = true;
				}
			}

			// Event listener for button click
			FMDXButton.addEventListener("click", function () {
				const data = previousDataByFrequency[currentFrequency];
				const station = data ? data.station : '';
				if (stationid) {
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
            const url = `https://maps.fmdx.org/#qth=${LAT},${LON}&id=${stationid}&findId=*`;

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

				// Eventlistener for button click
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
						alert (`Station-ID: ${stationid} is not compatible with FMLIST Database!`);
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
			const now = new Date();
			const date = formatDate(now);
			let time = formatTime(now);
			
			if (UTCtime) {
				time = getCurrentUTC(); // time in UTC
			}
		  
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
				let stationid = "";
                    
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
			stationid = (test_stationid);
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
			stationid = (data.stationid);
			picode_clean = (data.picode);

        }
		
		        if (currentFrequency !== previousFrequency) {
					previousFrequency = currentFrequency;
					NewLine = 'true';
					id = '';
					dateFilter = formatDate(now);
					if (UTCtime) {
						timeFilter = getCurrentUTC(); // time in UTC
					} else {
						timeFilter = formatTime(now);
					}
					Savepicode = picode_clean;
				}
			
				if (picode_clean.replace(/\?/g, '') !== picode_clean.replace(/\?/g, '')) {								
					dateFilter = formatDate(now);				
					if (UTCtime) {
						timeFilter = getCurrentUTC(); // time in UTC
					} else {
						timeFilter = formatTime(now);
					}
				}
				
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


                if (!blacklist.length || !isInBlacklist(currentFrequency, blacklist)) {

						if (stationid !== "" && stationid >= 0) {
							if (!stationidAll.split(',').includes(stationid.toString())) {
								stationidAll += stationidAll ? `,${stationid}` : stationid;
							}
						}
                
                        const newOutputDiv = document.createElement("div");
                        newOutputDiv.style.whiteSpace = "pre-wrap";
                        newOutputDiv.style.fontSize = "16px";
                        newOutputDiv.style.marginBottom = "-1px";
                        newOutputDiv.style.padding = "0 10px";
						let lastOutputArray;
														
						if (NewLine === 'true' || picode_clean.replace(/\?/g, '') !== Savepicode.replace(/\?/g, '') && (ps !== '?' && station !== '')) {		

								if (dataCanvas instanceof Node) {
									dataCanvas.appendChild(newOutputDiv);
								}
								
								
								if (!picode.includes('??') && !picode.includes('???')) {
									if (FilterState) {
										const lastOutputDiv = dataCanvas.lastChild;							
										lastOutputDiv.textContent = outputTextFilter;
									}
									lastOutputArray = outputArrayFilter;
								}							
								
								FilteredlogDataArray[FilteredlogDataArray.length +1] = lastOutputArray
								NewLine = 'false'; 
												
						}

						if ((ps !== '?' && station !== '') && !picode_clean.includes('??') && !picode_clean.includes('???')) {
						
							if (FilterState) {							
								const lastOutputDiv = dataCanvas.lastChild;
								lastOutputDiv.textContent = outputTextFilter;
							}	
								
							FilteredlogDataArray[FilteredlogDataArray.length -1] = outputArrayFilter;
							SaveFrequency = currentFrequencyWithSpaces.replace(/\s/g, '');

						}
						
						if (NewLine === 'true' || Savepicode !== picode_clean || Savestation !== station && station !== '' || Saveps !== ps && ps !== '') {
							
							if (!FilterState) {
						
								if (dataCanvas instanceof Node) {
									dataCanvas.appendChild(newOutputDiv);
								}
							
								const lastOutputDiv = dataCanvas.lastChild;
								lastOutputDiv.textContent = outputText;	
							}
							
							logDataArray[logDataArray.length +1] = outputArray;	
							NewLine = 'false'; 
				
						}
											
						
                        Savepicode = picode_clean;
                        Savestation = station;
						Savestationid = stationid;
						Saveps = ps;
						dataCanvas.scrollTop = dataCanvas.scrollHeight - dataCanvas.clientHeight;					
						
				}
            }
        }

   // Toggle logger state and update UI accordingly
function toggleLogger() {
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


        // Initialize on window load
        window.onload = function () {
            initializeLoggerButton();
            checkBlacklist();
        };

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
        : 'date;time;freq;pi;ps;name;city;itu;pol;erp;dist;az;id\n' 
		
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
        ? `<table border="1"><tr><th>DATE</th><th>TIME(UTC)</th><th>FREQ</th><th>PI</th><th>PS</th><th>NAME</th><th>CITY</th><th>ITU</th><th>P</th><th>ERP</th><th>DIST</th><th>AZ</th><th>ID</th><th>FMDX</th><th>FMLIST</th></tr>` 
        : `<table border="1"><tr><th>DATE</th><th>TIME</th><th>FREQ</th><th>PI</th><th>PS</th><th>NAME</th><th>CITY</th><th>ITU</th><th>P</th><th>ERP</th><th>DIST</th><th>AZ</th><th>ID</th><th>FMDX</th><th>FMLIST</th></tr>`;

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

    let finalLink = `https://maps.fmdx.org/#qth=${LAT},${LON}&id=${stationidAll}&findId=*`;
    allData += `</table></pre><pre><a href="${finalLink}" target="_blank">FMDX ALL</a></body></html>`;

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
    // Hole die aktuelle Zeit in UTC
    const now = new Date();
    
    // Extrahiere die UTC-Stunden, -Minuten und -Sekunden
    const hours = String(now.getUTCHours()).padStart(2, '0');
    const minutes = String(now.getUTCMinutes()).padStart(2, '0');
    const seconds = String(now.getUTCSeconds()).padStart(2, '0');
    
    // Formatiere die Zeit im HH:MM:SS-Format
    const utcTime = `${hours}:${minutes}:${seconds}`;

    return utcTime;
}

    })();
})();

const htmlTemplate = `
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SCANNER LOG [FILTER MODE]</title>
    <style>
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
        }

        /* Styling for the search input */
        #searchInput {
            padding: 5px;
            width: 100%;
            max-width: 400px;
            box-sizing: border-box;
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

        /* Filters table rows based on input value */
        function filterTable() {
            const input = document.getElementById("searchInput");
            const filter = input.value.toLowerCase();
            const table = document.querySelector("table");
            const tr = table.getElementsByTagName("tr");

            /* Loop through all table rows */
            for (let i = 1; i < tr.length; i++) {
                let td = tr[i].getElementsByTagName("td");
                let display = false;
                for (let j = 0; j < td.length; j++) {
                    /* Check if any cell contains the filter text */
                    if (td[j].textContent.toLowerCase().indexOf(filter) > -1) {
                        display = true;
                        break;
                    }
                }
                /* Show or hide the row based on the filter */
                tr[i].style.display = display ? "" : "none";
            }
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

        /* Initializes controls on DOMContentLoaded */
        document.addEventListener('DOMContentLoaded', () => {
            applyDarkMode(); // Apply Dark Mode preference

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
        });
    </script>
</head>
<body>
<pre></pre>
</body>
</html>
`;

