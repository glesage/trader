// var moment = require('moment');
var BitfinexWS = require('bitfinex-api-node');
var TradeSheet = require('./sheet');
var Trader = require('./trader');


var driveCreds = JSON.parse(process.env.DRIVE_CREDS);
var sheet = new TradeSheet(process.env.DRIVE_SHEET, driveCreds);
var bws = new BitfinexWS(process.env.BIT_KEY, process.env.BIT_SECRET).ws;
var trader = new Trader(process.env.RISK, process.env.FEE);


startCalculating();


/**
 * Bitfinex socket listeners
 */
bws.on('open', function ()
{
    bws.subscribeTrades('BTCUSD');
});
bws.on('trade', function (pair, trade)
{
    trader.recordTrade(trade);
    sheet.recordTrade(trade).catch(console.log);
});
bws.on('error', console.error);


/**
 * Masterminding
 *
 * Every 10 seconds, record to drive what the trader is calculating
 */
function startCalculating()
{
    setInterval(function ()
    {
        var data = trader.masterpiece();
        if (data) sheet.updateTraderData(data).catch(console.log);
    }, 1000);
}
