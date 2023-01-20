const _ = require("lodash");

module.exports = function() {
    let prompt = "";

    if(_.random(0.0, 1.0, true) < 0.5)
        prompt += ", [[house]]"

    if(_.random(0.0, 1.0, true) < 0.5)
        prompt += ", [[village]]"

    if(_.random(0.0, 1.0, true) < 0.5)
        prompt += ", [[path]]"

    if(_.random(0.0, 1.0, true) < 0.5)
        prompt += ", worn down";

    if(_.random(0.0, 1.0, true) < 0.5)
        prompt += ", weathered";

    return prompt;
}
