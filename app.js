/* Dependencies */
var BitfinexWS = require('bitfinex-api-node');
var TradeSheet = require('./sheet');
var Trader = require('./trader');
var DB = require('./db');


var sheet = new TradeSheet(process.env.DRIVE_SHEET, process.env.DRIVE_CREDS);
var bws = new BitfinexWS(process.env.BIT_KEY, process.env.BIT_SECRET).ws;
var trader = new Trader(parseFloat(process.env.RISK), parseFloat(process.env.FEE));
var db = new DB(process.env.MONGO_URL);


/**
 * Bitfinex socket listeners
 */
bws.on('open', function ()
{
    bws.subscribeTrades('BTCUSD');
});
bws.on('trade', function (pair, trade)
{
    db.recordTrade(trade).catch(console.log);
    sheet.recordAllTrade(trade).catch(console.log);

    var tradeData = trader.inboundTrade(trade);
    db.recordTraderData(tradeData).catch(console.log);

    checkBuySell(trade.price);
});
bws.on('error', console.error);

/**
 * Check the trader to find out if we should buy or sell
 */
function checkBuySell(lastTradePrice)
{
    if (trader.timeToBuy(lastTradePrice))
    {
        sheet.recordMyTrade(
        {
            price: lastTradePrice,
            timestamp: Date.now(),
            type: 'buy',
            volume: 1
        }).catch(console.log);
        trader.boughtAt(lastTradePrice);
    }
    else if (trader.timeToSell(lastTradePrice))
    {
        sheet.recordMyTrade(
        {
            price: lastTradePrice,
            timestamp: Date.now(),
            type: 'sell',
            volume: 1
        }).catch(console.log);
        trader.soldAt(lastTradePrice);
    }
}

/**
 * Every 30 seconds log in drive what the trader is thinking
 * for debugging purposes for now
 */
setInterval(function ()
{
    var data = trader.logCurrentData();
    if (data) sheet.recordTraderData(data).catch(console.log);
}, 30000);
