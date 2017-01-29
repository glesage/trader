var moment = require('moment');

function logger(trader, sheet)
{
    var self = this;
    self.traderData = traderData;
    self.orderUpdate = orderUpdate;
    return self;

    /**
     * Utility to log an order/trade to google sheets
     */
    function orderUpdate(order)
    {
        var prettyOrder = order.sheetsFormat();
        if (!prettyOrder) return;
        sheet.recordMyTrade(prettyOrder).catch(function (err)
        {
            console.log("Could not record order to drive sheets");
            console.log(err);
        });
    }

    /**
     * Utility to log what the trader is thinking
     * for debugging purposes for now
     */
    var lastResistanceZone = -1;
    var lastSupportZone = -1;

    function traderData(data)
    {
        var currentData = JSON.parse(JSON.stringify(data));

        currentData.supportZone = 0;
        if (trader.highestSupportZone)
        {
            var sz = parseFloat(trader.highestSupportZone);
            if (!isNaN(sz) && sz > 0) currentData.supportZone = sz;
        }

        currentData.resistanceZone = 0;
        if (data.lastBuy)
        {
            currentData.resistanceZone = trader.resistanceZone(data.lastBuy.price);
        }

        if (currentData.resistanceZone === lastResistanceZone &&
            currentData.supportZone === lastSupportZone) return;

        delete currentData.lastBuy;
        delete currentData.lastSell;

        lastResistanceZone = currentData.resistanceZone;
        lastSupportZone = currentData.supportZone;

        currentData.time = moment().format('MM/DD HH:mm:ss');

        sheet.recordTraderData(currentData).catch(function (err)
        {
            console.log("Could not record trader data");
            console.log(err);
        });
    }
}

module.exports = logger;
