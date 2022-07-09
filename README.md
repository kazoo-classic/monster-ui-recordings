# Monster UI Recordings

Allows you to effectively work with call recordings for v4.3

Requires [Monster UI v.4.3](https://github.com/2600hz/monster-ui)

Ensure you've storage setup (Amazon S3, Google Drive, etc.)

Also, ensure you've enabled `cb_recordings` module

#### Installation instructions:
1. Copy the recordings app to your apps directory
2. Register the recordings app
```bash
# sup crossbar_maintenance init_app PATH_TO_RECORDING_DIRECTORY API_ROOT
# The Kazoo user should be able to read files from recordings app directory
sup crossbar_maintenance init_app /var/www/html/monster-ui/apps/recordings https://site.com:8443/v2/
```
3. Activate recordings app in the Monster UI App Store ( `/#/apps/appstore` )