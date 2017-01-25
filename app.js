/* Dependencies */
var BitfinexWS = require('bitfinex-api-node');
var TradeSheet = require('./lib/sheet');
var Trader = require('./lib/trader');
var DB = require('./lib/db');


var sheet = new TradeSheet(process.env.DRIVE_SHEET, process.env.DRIVE_CREDS);
var bws = new BitfinexWS(process.env.BIT_KEY, process.env.BIT_SECRET).ws;
var trader = new Trader(parseFloat(process.env.RISK), parseFloat(process.env.FEE));
var db = new DB(process.env.MONGO_URL);


var data = {
    balanceUSD: 10000,
    balanceBTC: 0,
    lastBuyAt: 0,
    lastSellAt: 0
};


restoreData();


/**
 * Bitfinex socket listeners
 */
bws.on('open', function ()
{
    bws.subscribeTrades('BTCUSD');
    startTracking();
});
bws.on('trade', function (pair, trade)
{
    recordTrade(trade);
    checkBuySell(trade.price);
});
bws.on('error', console.error);


/**
 * Record any incomming trades and alert the trader
 */
function recordTrade(trade)
{
    trader.inboundTrade(trade);
    db.recordTrade(trade).catch(console.log);
}


/**
 * Check the trader to find out if we should buy or sell
 */
function checkBuySell(currentTicker)
{
    if (data.balanceBTC > 0)
    {
        if (!trader.timeToSell(currentTicker, data.lastBuyAt)) return;

        sheet.recordMyTrade(
        {
            timestamp: Date.now(),
            ticker: currentTicker,
            type: 'sell',
            amountUSD: data.balanceBTC * currentTicker,
            amountBTC: data.balanceBTC
        }).catch(console.log);

        data.balanceBTC = 0;
        data.balanceUSD = data.balanceBTC * currentTicker;
    }
    else if (data.balanceUSD > 0)
    {
        if (!trader.timeToBuy(currentTicker)) return;

        sheet.recordMyTrade(
        {
            timestamp: Date.now(),
            ticker: currentTicker,
            type: 'buy',
            amountUSD: data.balanceUSD,
            amountBTC: data.balanceUSD / currentTicker
        }).catch(console.log);

        data.balanceBTC = data.balanceUSD / currentTicker;
        data.balanceUSD = 0;
    }
}

/**
 * Every 30 seconds log in drive what the trader is thinking
 * for debugging purposes for now
 */
function startTracking()
{
    setInterval(function ()
    {
        var currentData = JSON.parse(JSON.stringify(data));
        currentData.timestamp = Date.now();
        currentData.supportZone = trader.highestSupportZone;

        db.recordTraderData(currentData).catch(console.log);
        sheet.recordTraderData(currentData).catch(console.log);
    }, 30000);
}

/**
 * Utility to restore the session data using backup in MongoDB
 */
function restoreData()
{
    db.getLastTraderData(null, ['timestamp'], 1).then(function (traderData)
    {
        if (!traderData) return;

        data.balanceUSD = parseFloat(traderData.balanceUSD) || 0;
        data.balanceBTC = parseFloat(traderData.balanceUSD) || 0;
        data.lastBuyAt = parseFloat(traderData.lastBuyAt) || 0;
        data.lastSellAt = parseFloat(traderData.lastSellAt) || 0;
        trader.highestSupportZone = parseFloat(traderData.supportZone) || 0;

    });
}
