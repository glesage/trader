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

export RISK=0.0001
export MAX_WAIT=300000
export MAX_LOSS=0.01

export ALLOW_BUY=1
export ALLOW_SELL=1
```
