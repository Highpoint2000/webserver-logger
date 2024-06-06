# Logger Plugin for [FM-DX-Webserver](https://github.com/NoobishSVK/fm-dx-webserver)

![image](https://github.com/Highpoint2000/webserver-logger/assets/168109804/3b083f78-9f0a-4733-8d70-f7dd1056188b)

## Installation notes:

1. [Download](https://github.com/Highpoint2000/webserver-logger/releases) the last repository as a zip
2. Unpack the Logger.js and the Scanner folder with the logger-plugin.js into the web server plugins folder (..fm-dx-webserver-main\plugins) [image](https://github.com/Highpoint2000/webserver-logger/assets/168109804/98b38e5d-e58c-4192-b69c-739b608cf118)
4. Restart the server
5. Activate the plugin it in the settings

This plugin provides scanning functions for the FM-DX web server.

## Notes: 

If the logging plugin is activated, logging in the background is started automatically after every website reload. By pressing the DATA LOGGER switch button, the screen switches from the signal display to the logging tool. The real-time mode logs the current data record (prerequisite: PI code must be read in) in the constantly updated list. You can scroll through the logs using the scroll bar on the right. You can download the current logging list in the appropriate format using the CSV or TXT button. Using the “Blacklist” button, a stored frequency list with exclusions can be activated and deactivated.*

### Version 1.1

- Visible real-time logging
- Improvements to the UI interface (Preparation of log data)
- change the names of the download files (+date +time)
- Additional information in the download files
- Tabular representation in the TXT file
- Blacklist option (Frequency skipping) *

* In order for the blacklist button and option to be usable, a file /web/logger/blacklist.txt must be created. The frequencies that are not to be logged must be, for example: 89.800 89.400 100.80 ... They can be written next to or below each other with spaces.

## History: 

### Version 1.0
- Automatic background logging 
- Download option (txt/xls format)
