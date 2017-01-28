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

export BIT_KEY="" // Bitfinex API KEY
export BIT_SECRET="" // Bitfinex API SECRET

export MAX_RISK=0.02 // Max difference of price to trade at
export MIN_RISK=0.01 // Min difference of price to trade at
```