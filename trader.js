/**
 * Trader responsible for financial calculations:
 * - calculating support & resistance lines
 * - figuring out when to buy or sell
 *
 * Takes a risk percentage and fee percentage
 */
module.exports = function (RISK, FEE)
{
    var highestSupportZone = null;
    var lowestResistanceZone = null;
    var myLastTrade = 0;

    var self = this;
    self.inboundTrade = inboundTrade;
    self.timeToBuy = timeToBuy;
    self.timeToSell = timeToSell;
    self.boughtAt = boughtAt;
    self.soldAt = soldAt;
    self.logCurrentData = logCurrentData;
    return self;

    /* Public */
    function inboundTrade(trade)
    {
        var amount = parseFloat(trade.amount);
        var price = parseFloat(trade.price);

        var riskCoeficient = (RISK / 2) + FEE;
        var data = {
            timestamp: trade.timestamp,
            support: price - (price * riskCoeficient),
            resistance: price + (price * riskCoeficient)
        };

        if (!highestSupportZone || highestSupportZone < data.support)
        {
            highestSupportZone = data.support;
        }
        if (!lowestResistanceZone || lowestResistanceZone > data.resistance)
        {
            lowestResistanceZone = data.resistance;
        }

        return data;
    }

    function timeToBuy(price)
    {
        // If the last operation was a buy, don't buy again
        if (myLastTrade > 0) return false;

        // If the support zone is lower than the current price, don't try to buy yet
        if (!highestSupportZone || highestSupportZone < price) return false;

        return true;
    }

    function timeToSell(price)
    {
        // If the last operation was a sell, don't sell again
        if (myLastTrade < 0) return false;

        // If the resistance zone is higher than the current price, don't try to sell yet
        if (!lowestResistanceZone || lowestResistanceZone > price) return false;

        return true;
    }

    function boughtAt(price)
    {
        myLastTrade = price;
    }

    function soldAt(price)
    {
        myLastTrade = -price;
    }

    function logCurrentData()
    {
        return {
            timestamp: Date.now(),
            highestSupportZone: highestSupportZone,
            lowestResistanceZone: lowestResistanceZone,
            myLastTrade: myLastTrade
        };
    }
};
