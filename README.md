# RDS-Logger Plugin for [FM-DX-Webserver](https://github.com/NoobishSVK/fm-dx-webserver)
This plugin provides logging functions for the FM-DX web server.

![image](https://github.com/user-attachments/assets/7077e761-1c27-4449-a1b2-2cc7c73eb17a)



![image](https://github.com/user-attachments/assets/672fef04-f4d8-48dc-88b1-7c4b1f2241ad)

## Version 1.7b (only works from web server version 1.3.5!!!)

- Scanner CSV Log File can be downloaded again via the Download button (requires Scanner Plugin Version from 3.4)

## Installation notes:

1. [Download](https://github.com/Highpoint2000/webserver-logger/releases) the last repository as a zip
2. Unpack the Logger.js and the Logger folder with the logger-plugin.js into the web server plugins folder (..fm-dx-webserver-main\plugins) [image](https://github.com/Highpoint2000/webserver-logger/assets/168109804/98b38e5d-e58c-4192-b69c-739b608cf118)
3. Restart the server
4. Activate the plugin it in the settings

## Configuration options:

The following variables can be changed in the configPlugin.json:


    FMLIST_OM_ID = '',           // If you want to use the logbook function, enter your OM ID here, e.g., FMLIST_OM_ID = '1234'
    Screen = '',                 // Set to 'small' or 'ultrasmall' if unwanted horizontal scroll bars appear
    ScannerButtonView = false,   // Set to 'true' to display a button for downloading scanner file links
    UTCtime = true,              // Set to 'true' to log using UTC time
    updateInfo = true            // Enable or disable version check	

## Notes: 

If the logging plugin is activated, logging starts automatically in the background every time the website is reloaded. Pressing the RDS LOGGER shift key switches the screen from the signal display to the logging tool. The real-time mode logs the current data record in a constantly updating list (requirement: PI code must be read in). You can scroll through the logs using the scroll bar on the right. You can download the current logging list in the appropriate format using the CSV or HTML button. A stored list of frequency exclusions can be activated and deactivated using the “Blacklist” button.* The FILTER button only displays identified protocols (i.e. with TX information) and filters out excess entries. If the filter button is activated before the download, it enables the download of the filtered protocol lists. You can display an additional button using the “ScannerButtonView” switch. If this is activated, the downloads will be linked to the scanner log files. You can use the MAPALL button to display all logged broadcast locations graphically on a map. If you have an account with fmlist.org, you can either use the FMLIST button to transfer the current log or later transfer the logs from the logs to your FMLIST logbook. To do this, you must enter your OM ID once in the logger-plugin.js before accessing the web server and log in with your access data at https://fmlist.org. Only then will the link work! If the horizontal scroll bar seems undesirable, please increase the screen limit variable from 1180 to 1185 in the script.
(*) In order to use the blacklist button and option, a file /web/logger/blacklist.txt must be created. For example, the frequencies that should not be logged must be: 89,800 89,400 100.80 ... They can be written next to or below each other with spaces.

Users who also use the Extended Description plugin should download the modified version from here, where the buttons are displayed in one line: https://github.com/Highpoint2000/Extended-Description-plugin-MOD-by-Highpoint-

![image](https://github.com/user-attachments/assets/18a0eae5-af68-4b81-875a-07e385517c79)

## Contact

If you have any questions, would like to report problems, or have suggestions for improvement, please feel free to contact me! You can reach me by email at highpoint2000@googlemail.com. I look forward to hearing from you!

<a href="https://www.buymeacoffee.com/Highpoint" target="_blank"><img src="https://tef.noobish.eu/logos/images/buymeacoffee/default-yellow.png" alt="Buy Me A Coffee" ></a>

<details>
<summary>History</summary>

### Version 1.7a (only works from web server version 1.3.5!!!)

- Design adjustments
- Button in the mobile view is no longer displayed

### Version 1.7 (only works from web server version 1.3.5!!!)

- Design adjustments for web server version 1.3.5

### Version 1.6d (only works from webserver version 1.2.6!)

- PS code verification improved


### Version 1.6c (only works from webserver version 1.2.6!)

- Adjustments for the Spectrum Graph plugin
- Daily update check for admin

### Version 1.6b (only works from webserver version 1.2.6!)

- Improved scrolling behavior (thanks to AmateurAudioDude!)

### Version 1.6a (only works from version 1.2.6 - older versions must take the plugin version 1.3f or 1.3i !!!)

- Plugin configuration can be loaded from configPlugin.json file (only Windows systems!)
- FMDX button became MAPALL and now calls up the map with all logs
- test was removed from the code
- Add PI-Code filter to the html log file
- HTML Language Tag set to English

### Version 1.6 (only works from version 1.2.6 - older versions must take the plugin version 1.3f or 1.3i !!!)

- New layout for HTML logfile with search/sort Options, Toggle Button for dark mode
- Time in Logfiles can be set to UTC
- The filter mode is active at start
- FMLIST Link only appears in the log files if an OMID was stored in the script
- Proxy server adjustments (thanks to _zer0_gravity_!)
- Download adjustments are the scanner log files
- Renamed maps.fmdx.pl to maps.fmdx.org and FMDX links to MAP links
- The MAP ALL link is now created dynamically and adapts to the log filter, and there are now distance restrictions in the log file

### Version 1.5 (only works from version 1.2.6 - older versions must take the plugin version 1.3f or 1.3i !!!)

- Alert message/filter for non-FMLIST compatible station IDs 
- Logging optimizations (RDS RAW and filtered mode)
- HTML logs now open directly in the browser
- Scanner log files (if available!) can be downloaded using CSV and HTML download buttons (Option for the button is in the scriptheader!)

### Version 1.4 (only works from version 1.2.6 - older versions must take the plugin version 1.3f or 1.3i !!!)

- compatible with changed websocket data in version 1.2.6
- remove the cors-proxy 

### Version 1.3i (only works from version 1.2.5 - older versions must take the plugin version 1.3f !!!)

- RDS-LOGGER Button Position Update (several buttons in one line)   

### Version 1.3h (only works from version 1.2.5 - older versions must take the plugin version 1.3f !!!)

- Function Update für [PSTRotator Plugin](https://github.com/Highpoint2000/PSTRotator) 

### Version 1.3g (only works from web server version 1.2.5 - older versions must take the plugin version 1.3f !!!)

- Design Update

### Version 1.3f (only works from web server version 1.2.3 - older versions must take the plugin version 1.3d !!!)

- HTTPS Support for internal CORS PROXY  
- FMLIST Button is only visible if OM_ID is entered
- FMLIST & FMDX Buttons light up when identification is successful

### Version 1.3e (only works from web server version 1.2.3!)

- Problem with multiple connections (user online) fixed

### Version 1.3d

- Logging optimizations

### Version 1.3c

- Layout adjustment for smaller screens
- Logging optimizations

### Version 1.3b

- Error correction in html export
- Improved error display
- Bug fixing

### Version 1.3a

- Fixed Problems with table layout
- Optimization of the filter function for html-exports

### Version 1.3

- Added filter function for logging and downloading (see description above!)
- fixed the overwrite bug when pressing up down frequently
- remove the txt download

### Version 1.2b

- Fixed the datatransfer bug for FMLIST from the html File

### Version 1.2a

- Fixed location search bug

### Version 1.2

- Logbook option for fmlist.org
- Display of the transmission location of individual and all stations on maps.fmdx.pl
- Download the log list in html format with links to maps.fmdx.pl and fmlist.org

### Version 1.1

- Visible real-time logging
- Improvements to the UI interface (Preparation of log data)
- change the names of the download files (+date +time)
- Additional information in the download files
- Tabular representation in the TXT file
- Blacklist option (Frequency skipping)

### Version 1.0
- Automatic background logging 
- Download option (txt/xls format)
