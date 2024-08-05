////////////////////////////////////////////////////////////
///                                                      ///
///  RDS-LOGGER SCRIPT FOR FM-DX-WEBSERVER (V1.4a BETA)  ///
///                                                      ///
///  by Highpoint                last update: 05.08.24   ///
///                                                      ///
///  https://github.com/Highpoint2000/webserver-logger   ///
///                                                      ///
////////////////////////////////////////////////////////////

///  This plugin only works from web server version 1.2.6!!!

const FMLIST_OM_ID = ''; // To use the logbook function, please enter your OM ID here, for example: FMLIST_OM_ID = '1234'
const Screen = ''; // If you see unsightly horizontal scroll bars, set this value to 'small' or 'ultrasmall'
const TestMode = 'false'; // 'false' is only for testing
const plugin_version = 'V1.4a BETA'; // Plugin Version

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

        let ButtonsContainer = document.querySelector(".download-buttons-container");

        if (!ButtonsContainer) {
            ButtonsContainer = document.createElement("div");
            ButtonsContainer.className = "download-buttons-container";
            ButtonsContainer.style.display = "none";
            ButtonsContainer.style.position = "relative";
            ButtonsContainer.style.marginLeft = "76.5%";
            ButtonsContainer.style.marginTop = "0px";

            const FMLISTButton = createFMLISTButton();
            if (FMLISTButton instanceof Node) {
                ButtonsContainer.appendChild(FMLISTButton);
            }

            const FMDXButton = createFMDXButton();
            if (FMDXButton instanceof Node) {
                ButtonsContainer.appendChild(FMDXButton);
            }

            const FilterButton = setupFilterButton();
            if (FilterButton instanceof Node) {
                ButtonsContainer.appendChild(FilterButton);
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
            const url = `https://maps.fmdx.pl/#qth=${LAT},${LON}&id=${stationid}&findId=*`;

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

        }
                const outputText = station 
                    ? `${date}  ${time}  ${currentFrequencyWithSpaces}  ${picode}  ${ps}  ${station}  ${city}  ${itu}  ${pol}  ${erpTxt}  ${distance}  ${azimuth}`
                    : `${date}  ${time}  ${currentFrequencyWithSpaces}  ${picode}  ${ps}`;

                let outputArray = station 
                    ? `${date} | ${time} | ${currentFrequencyWithSpaces} | ${picode} | ${ps} | ${station} | ${city} | ${itu} | ${pol} | ${erpTxt} | ${distance} | ${azimuth} | ${stationid}`
                    : `${date} | ${time} | ${currentFrequencyWithSpaces} | ${picode} | ${ps} |                           |                       |     |   |        |      |    `;

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
									
						if (NewLine === 'true' || Savepicode !== picode && !picode.includes('?') && !ps.includes('?')) {						
		
							if (FilterState) { 	
		
								if (dataCanvas instanceof Node) {
									dataCanvas.appendChild(newOutputDiv);
								}	
							
								const lastOutputDiv = dataCanvas.lastChild;
								lastOutputDiv.textContent = outputText;
								
							}
								
							FilteredlogDataArray[FilteredlogDataArray.length +1] = outputArray;

						}

						if (picode.includes('?') || Savestationid !== stationid || ps.includes('?')) {
				
							if (FilterState) { 	
				
								const lastOutputDiv = dataCanvas.lastChild;
								lastOutputDiv.textContent = outputText;
							
							}
							
							FilteredlogDataArray[FilteredlogDataArray.length -1] = outputArray;

						}
						
						if (!FilterState && (NewLine === 'true' || Savepicode !== picode || Savestation !== station && station !== '' || Saveps !== ps && ps !== '')) {
						
							if (dataCanvas instanceof Node) {
								dataCanvas.appendChild(newOutputDiv);
							}
							
							const lastOutputDiv = dataCanvas.lastChild;
							lastOutputDiv.textContent = outputText;
							logDataArray[logDataArray.length +1] = outputArray;				
				
						}
						
						NewLine = 'false'; 
                        SaveFrequency = currentFrequencyWithSpaces.replace(/\s/g, '');
                        Savepicode = picode;
                        Savestation = station;
						Savestationid = stationid;
						Saveps = ps;
						dataCanvas.scrollTop = dataCanvas.scrollHeight - dataCanvas.clientHeight;					
						
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
    const ButtonsContainer = document.querySelector('.download-buttons-container');
    const antennaImage = document.querySelector('#antenna'); // Ensure ID 'antenna' is correct
    isLoggerOn = !isLoggerOn;

    if (isLoggerOn) {
        // Update button appearance
        LoggerButton.classList.remove('bg-color-2');
        LoggerButton.classList.add('bg-color-4');
        
        // Perform actions when logger is on
        coverTuneButtonsPanel(true); // Cover when logger is on
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
        coverTuneButtonsPanel(false); // Remove cover when logger is off
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

function downloadDataCSV() {
    try {
        const now = new Date();
        const currentDate = formatDate(now);
        const currentTime = formatTime(now);
        const filename = `RDS-LOGGER_${currentDate}_${currentTime}.csv`;

        const filterState = getFilterStateFromCookie().state;

        // Initialize CSV data with headers and metadata
        let allData = `"${ServerName}"\n"${ServerDescription.replace(/\n/g, ". ")}"\n`;
        allData += filterState ? `RDS-LOGGER [FILTER MODE] ${currentDate} ${currentTime}\n\n` : `RDS-LOGGER ${currentDate} ${currentTime}\n\n`;
        allData += 'date;time;freq;pi;ps;name;city;itu;pol;erp;dist;az;id\n';

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

async function downloadDataHTML() {
    const now = new Date();
    const currentDate = formatDate(now);
    const currentTime = formatTime(now);
    const filename = `RDS-LOGGER_${currentDate}_${currentTime}.html`;

    const filterState = getFilterStateFromCookie().state;

    let allData = `<html><head><title>RDS Logger</title></head><body><pre>${ServerName}<br>${ServerDescription.replace(/\n/g, "<br>")}<br>`;
    allData += filterState ? `RDS-LOGGER [FILTER MODE] ${currentDate} ${currentTime}<br><br>` : `RDS-LOGGER ${currentDate} ${currentTime}<br><br>`;
    allData += `<table border="1"><tr><th>DATE</th><th>TIME</th><th>FREQ</th><th>PI</th><th>PS</th><th>NAME</th><th>CITY</th><th>ITU</th><th>P</th><th>ERP</th><th>DIST</th><th>AZ</th><th>ID</th><th>FMDX</th><th>FMLIST</th></tr>`;

    // Use filteredLogDataArray if filter is active, otherwise use logDataArray
    const dataToUse = filterState ? FilteredlogDataArray : logDataArray;

    dataToUse.forEach(line => {
        if (typeof line !== 'string') {
            console.error(`Invalid line found: ${line}`);
            return; // Skip this iteration if line is not a string
        }

        let [date, time, freq, pi, ps, name, city, itu, pol, erpTxt, distance, azimuth, id] = line.split('|').map(value => value.trim());

        let link1 = id !== '' ? `<a href="https://maps.fmdx.pl/#qth=${LAT},${LON}&id=${id}&findId=*" target="_blank">FMDX</a>` : '';
        let link2 = id !== '' && id > 0 ? `<a href="https://www.fmlist.org/fi_inslog.php?lfd=${id}&qrb=${distance}&qtf=${azimuth}&country=${itu}&omid=${FMLIST_OM_ID}" target="_blank">FMLIST</a>` : '';

        allData += `<tr><td>${date}</td><td>${time}</td><td>${freq}</td><td>${pi}</td><td>${ps}</td><td>${name}</td><td>${city}</td><td>${itu}</td><td>${pol}</td><td>${erpTxt}</td><td>${distance}</td><td>${azimuth}</td><td>${id}</td><td>${link1}</td><td>${link2}</td></tr>\n`;

    });

    let finalLink = `https://maps.fmdx.pl/#qth=${LAT},${LON}&id=${stationidAll}&findId=*`;
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


    })();
})();
