const btfnxPrice = require('./utilities').btfnxPrice;

/**
 * Average responsible for keeping track of current average price,
 * calculated using provided time resolution in ms
 */
module.exports = function (timeResolution)
{
    const currentTrades = [];

    const self = this;
    self.updatedAverage = function (trade)
    {
        removeOldTrades();

        if (trade) currentTrades.push(trade);

        return getWeightedAverage();
    };
    return self;

    /* Private methods */
    function removeOldTrades()
    {
        const now = Date.now();
        let index = currentTrades.length;
        while (index--)
        {
            const t = currentTrades[index];
            if (t.timestamp + timeResolution < now) continue;
            currentTrades.splice(index, 1);
        }
    }

    function getWeightedAverage()
    {
        let totalVolume = 0;
        let sum = 0;
        let index = currentTrades.length;
        while (index--)
        {
            const t = currentTrades[index];
            sum += parseFloat(t.price) * parseFloat(t.amount);
            totalVolume += parseFloat(t.amount);
        }

        return btfnxPrice(sum / totalVolume);
    }
};