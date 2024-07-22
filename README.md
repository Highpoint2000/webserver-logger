# RDS-Logger Plugin for [FM-DX-Webserver](https://github.com/NoobishSVK/fm-dx-webserver)

![image](https://github.com/user-attachments/assets/cf5acb5d-9103-43cb-af11-fa5aae40e568)


## Version 1.3g (only works from web server version 1.2.5 - older versions must take the plugin version 1.3f !!!)

- Design Update 

## Installation notes:

1. [Download](https://github.com/Highpoint2000/webserver-logger/releases) the last repository as a zip
2. Unpack the Logger.js and the Logger folder with the logger-plugin.js into the web server plugins folder (..fm-dx-webserver-main\plugins) [image](https://github.com/Highpoint2000/webserver-logger/assets/168109804/98b38e5d-e58c-4192-b69c-739b608cf118)
4. Restart the server
5. Activate the plugin it in the settings

This plugin provides scanning functions for the FM-DX web server.

## Notes: 

If the logging plugin is activated, logging in the background will automatically start after every website reload. Pressing the DATA LOGGER toggle button switches the screen from the signal display to the logging tool. The real-time mode logs the current data set (prerequisite: PI code must be read in) in a constantly updated list. You can scroll through the logs using the scroll bar on the right. You can download the current logging list in the appropriate format using the CSV or HTML button. A stored list of frequency exclusions can be activated and deactivated using the “Blacklist” button.* The FILTER button either only records identified logs (i.e. with TX information) or sorts the standard log list by frequency and filters out excess entries Filter is activated before downloading the log lists.  You can use the FMDX button to display the current transmission location graphically on a map. If you have an account at fmlist.org, you can either use the FMLIST button to transfer the current log or later transfer the logs from the logs to your FMLIST logbook. To do this, you must enter your OM ID once in the logger-plugin.js before accessing the web server and log in with your access data at https://fmlist.org. Only then will the link work! If the horizontal scroll bar appears undesirably, please increase the screen limit variable from 1180 to 1185 in the script.

(*) In order to use the blacklist button and option, a file /web/logger/blacklist.txt must be created. For example, the frequencies that should not be logged must be: 89,800 89,400 100.80 ... They can be written next to or below each other with spaces.

## History: 

## Version 1.3f (only works from web server version 1.2.3 - older versions must take the plugin version 1.3d !!!)

- HTTPS Support for internal CORS PROXY  
- FMLIST Button is only visible if OM_ID is entered
- FMLIST & FMDX Buttons light up when identification is successful

## Version 1.3e (only works from web server version 1.2.3!)

- Problem with multiple connections (user online) fixed

## Version 1.3d

- Logging optimizations

## Version 1.3c

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
