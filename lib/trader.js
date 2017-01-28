/**
 * Trader responsible for financial calculations:
 * - calculating support & resistance lines
 * - figuring out when to buy or sell
 */
module.exports = function (risks, fees)
{
    var self = this;
    self.inboundTrade = inboundTrade;
    self.timeToBuy = timeToBuy;
    self.timeToSell = timeToSell;
    self.buyFee = buyFee;
    self.sellFee = sellFee;
    self.highestSupportZone = 0;
    self.resistanceZone = resistanceZone;
    return self;

    /* Public */
    function inboundTrade(trade)
    {
        var price = parseFloat(trade[3]);
        var newSupportZone = supportZone(price);
        var newResistanceZone = resistanceZone(price);

        var csz = parseFloat(self.highestSupportZone);
        if (isNaN(csz)) self.highestSupportZone = 0;

        var nsz = parseFloat(newSupportZone);
        if (isNaN(nsz)) newSupportZone = 0;

        if (!self.highestSupportZone || self.highestSupportZone < newSupportZone)
        {
            self.highestSupportZone = newSupportZone;
        }
    }

    function timeToBuy(ticker)
    {
        // If the ticker is above the support zone, don't try to buy yet
        if (!self.highestSupportZone || self.highestSupportZone < ticker) return false;

        return true;
    }

    function timeToSell(ticker, buyTicker)
    {
        // If buyTicker is invalid, skip
        if (!buyTicker || buyTicker <= 0) return false;

        // If the ticker is below the resistance zone, don't try to sell yet
        if (ticker < resistanceZone(buyTicker)) return false;

        return true;
    }

    // Until proven otherwise, there is no fee on buys.. maybe
    function buyFee(ticker, usd)
    {
        return 0;
    }

    function sellFee(ticker, usd)
    {
        return ticker * fees.maker;
    }

    /* Private */
    function supportZone(price)
    {
        // The ticker amount below the current price required for a buy
        // Use half the risk since we want to sell at another half higher
        return price * (1 - (risks.min / 2));
    }

    function resistanceZone(price)
    {
        // The ticker amount above the current price required for a sell
        return price * (1 + (risks.min + fees.maker));
    }
};
