/**
 * Trader responsible for financial calculations:
 * - calculating support & resistance lines
 * - figuring out when to buy or sell
 *
 * Takes a risk percentage and fee percentage
 */
module.exports = function (RISK, FEE)
{
    var riskCoeficient = RISK + FEE;

    var self = this;
    self.inboundTrade = inboundTrade;
    self.timeToBuy = timeToBuy;
    self.timeToSell = timeToSell;
    self.highestSupportZone = 0;
    self.lowestResistanceZone = resistanceZone;
    return self;

    /* Public */
    function inboundTrade(trade)
    {
        var price = parseFloat(trade.price);
        var newSupportZone = supportZone(price);
        var newResistanceZone = resistanceZone(price);

        if (!self.highestSupportZone || self.highestSupportZone < newSupportZone)
        {
            self.highestSupportZone = newSupportZone;
        }
    }

    function timeToBuy(ticker)
    {
        // If the support zone is lower than the current price, don't try to buy yet
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

    /* Private */
    function supportZone(price)
    {
        return price - (price * (riskCoeficient / 2));
    }

    function resistanceZone(price)
    {
        return price + (price * riskCoeficient);
    }
};
