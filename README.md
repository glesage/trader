Bitcoin Trading Algorigthm [ ![Codeship Status for glesage/trader](https://app.codeship.com/projects/a9a273e0-c349-0134-4a6e-3a3b5ceba39a/status?branch=master)](https://app.codeship.com/projects/197567)
================

#### Installation
```
git clone
npm install
node app.js
```

#### Environment variables
```
export DRIVE_SHEET="" // ID of the drive sheet
export DRIVE_CREDS="" // JSON credentials file for drive sheet access

export BIT_WS_KEY="" // Bitfinex API KEY for websocket connection
export BIT_WS_SECRET="" // Bitfinex API SECRET for websocket connection

export BIT_REST_KEY="" // Bitfinex API KEY for rets connection
export BIT_REST_SECRET="" // Bitfinex API SECRET for rest connection

export RESOLUTION=3000 // Time resolution to calculate current average ticker, in ms
export MAX_WAIT=300000 // Maximum time to wait for price fluctuations before buying or selling, in ms
export RISK=0.0005 // Percentage change in best buy or sell price that would trigger a trade
export MAX_LOSS=0.01 // Maximum percentage loss
export MIN_GAIN=0.002 // Minimum percentage gain
```
