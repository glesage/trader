/* Dependencies */
var BitfinexWS = require('bitfinex-api-node');
var TradeSheet = require('./lib/sheet');
var Trader = require('./lib/trader');
var moment = require('moment');
var DB = require('./lib/db');


var fee = parseFloat(process.env.FEE);
var risk = parseFloat(process.env.RISK);

var sheet = new TradeSheet(
    process.env.DRIVE_SHEET,
    process.env.DRIVE_CREDS,
    process.env.SUFFIX
);
var bws = new BitfinexWS(process.env.BIT_KEY, process.env.BIT_SECRET).ws;
var trader = new Trader(risk, fee);
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
    trader.inboundTrade(trade);
    checkBuySell(trade.price);
});
bws.on('error', console.error);


/**
 * Check the trader to find out if we should buy or sell
 */
function checkBuySell(currentTicker)
{
    if (data.balanceBTC > 0)
    {
        if (!trader.timeToSell(currentTicker, data.lastBuyAt)) return;

        trader.highestSupportZone = 0;

        data.balanceUSD = (data.balanceBTC * currentTicker) * (1 - fee);
        data.balanceBTC = 0;

        data.lastSellAt = currentTicker;
        data.lastBuyAt = 0;

        sheet.recordMyTrade(
        {
            time: moment().format('MM/DD HH:mm:ss'),
            ticker: currentTicker,
            type: 'sell',
            amountUSD: data.balanceUSD,
            amountBTC: data.balanceBTC
        }).catch(console.log);
    }
    else if (data.balanceUSD > 0)
    {
        if (!trader.timeToBuy(currentTicker)) return;

        data.balanceBTC = (data.balanceUSD / currentTicker) * (1 - fee);
        data.balanceUSD = 0;

        data.lastBuyAt = currentTicker;
        data.lastSellAt = 0;

        sheet.recordMyTrade(
        {
            time: moment().format('MM/DD HH:mm:ss'),
            ticker: currentTicker,
            type: 'buy',
            amountUSD: data.balanceUSD,
            amountBTC: data.balanceBTC
        }).catch(console.log);
    }
}

/**
 * Every 120 seconds log what the trader is thinking
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

        var resistanceZone = trader.lowestResistanceZone(data.lastBuyAt);
        currentData.time = moment().format('MM/DD HH:mm:ss');
        currentData.resistanceZone = resistanceZone;
        sheet.recordTraderData(currentData).catch(console.log);
    }, 120000);
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
        data.balanceBTC = parseFloat(traderData.balanceBTC) || 0;
        data.lastBuyAt = parseFloat(traderData.lastBuyAt) || 0;
        data.lastSellAt = parseFloat(traderData.lastSellAt) || 0;

        trader.highestSupportZone = parseFloat(traderData.supportZone) || 0;
    });
}
