# RDS-Logger Plugin for [FM-DX-Webserver](https://github.com/NoobishSVK/fm-dx-webserver)
This plugin provides logging functions for the FM-DX web server.

![image](https://github.com/user-attachments/assets/4b4130f7-1df1-4911-b87a-3493df342d1d)


## Version 1.6 BETA (only works from version 1.2.6 - older versions must take the plugin version 1.3f or 1.3i !!!)

- New layout for HTML logfile with search/sort Options, Toggle Button for dark mode
- Time in Logfiles can be set to UTC
- The filter mode is active at start
- FMLIST Link only appears in the log files if an OMID was stored in the script
- Proxy server adjustments (thanks to _zer0_gravity_!)
- Download adjustments are the scanner log files
- Renamed maps.fmdx.pl to maps.fmdx.org

## Installation notes:

1. [Download](https://github.com/Highpoint2000/webserver-logger/releases) the last repository as a zip
2. Unpack the Logger.js and the Logger folder with the logger-plugin.js into the web server plugins folder (..fm-dx-webserver-main\plugins) [image](https://github.com/Highpoint2000/webserver-logger/assets/168109804/98b38e5d-e58c-4192-b69c-739b608cf118)
4. Restart the server
5. Activate the plugin it in the settings

## Notes: 

If the logging plugin is activated, logging starts automatically in the background every time the website is reloaded. Pressing the RDS LOGGER shift key switches the screen from the signal display to the logging tool. The real-time mode logs the current data record in a constantly updating list (requirement: PI code must be read in). You can scroll through the logs using the scroll bar on the right. You can download the current logging list in the appropriate format using the CSV or HTML button. A stored list of frequency exclusions can be activated and deactivated using the “Blacklist” button.* The FILTER button only displays identified protocols (i.e. with TX information) and filters out excess entries. If the filter button is activated before the download, it enables the download of the filtered protocol lists. You can display an additional button using the “ScannerButtonView” switch. If this is activated, the downloads will be linked to the scanner log files.  You can use the FMDX button to display the current broadcast location graphically on a map. If you have an account with fmlist.org, you can either use the FMLIST button to transfer the current log or later transfer the logs from the logs to your FMLIST logbook. To do this, you must enter your OM ID once in the logger-plugin.js before accessing the web server and log in with your access data at https://fmlist.org. Only then will the link work! If the horizontal scroll bar seems undesirable, please increase the screen limit variable from 1180 to 1185 in the script.
(*) In order to use the blacklist button and option, a file /web/logger/blacklist.txt must be created. For example, the frequencies that should not be logged must be: 89,800 89,400 100.80 ... They can be written next to or below each other with spaces.

Users who also use the Extended Description plugin should download the modified version from here, where the buttons are displayed in one line: https://github.com/Highpoint2000/Extended-Description-plugin-MOD-by-Highpoint-

![image](https://github.com/user-attachments/assets/18a0eae5-af68-4b81-875a-07e385517c79)



## History: 

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
