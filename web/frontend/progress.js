let backUrl = "/results";

function dataRefreshComplete(data) {

    // Ongoing Progress
    const progressOngoing = data.progressOngoing;
    const execOngoing = data.execOngoing;

    // Stop here if nothing is ongoing, proceed to re-index
    if(!execOngoing) {
        const encodedBackUrl = encodeURIComponent(backUrl);
        const params = new URLSearchParams({ backUrl: encodedBackUrl });
        window.location = `/re-index?${params}`;
        return;
    }

    // Image Progress
    const progressCurStep = data.progressCurStep;
    const progressTotalSteps = data.progressTotalSteps;
    const progressPercentSteps = (progressTotalSteps == 0) ? 100 : Math.round((progressCurStep / progressTotalSteps) * 100);
    $("#progress-steps").css("width", progressPercentSteps + "%");
    $("#progress-steps-cur").text(progressCurStep);
    $("#progress-steps-total").text(progressTotalSteps);

    // Image Batch Progress
    const progressCurImg = data.progressCurImg;
    const progressTotalImg = data.progressTotalImg;
    const progressPercentImg = (progressTotalImg == 0) ? 100 : Math.round(((progressCurImg + 1) / progressTotalImg) * 100);
    $("#progress-image").css("width", progressPercentImg + "%");
    $("#progress-image-cur").text(progressCurImg + 1);
    $("#progress-image-total").text(progressTotalImg);

    // Image Total Progress
    const progressPercent = Math.round(+data.progressPercent);
    const progressEta = data.progressEta;
    $("#progress-total").css("width", progressPercent + "%");
    $("#progress-total-percent").text(progressPercent + "%");
    $("#progress-total-eta").text(progressEta);

    // Prompts Progress
    const progressCurPrompt = data.progressCurPrompt;
    const progressTotalPrompts = data.progressTotalPrompts;
    const progressPercentPrompts = (progressTotalPrompts == 0) ? 100 : Math.round((progressCurPrompt / progressTotalPrompts) * 100);
    $("#progress-prompts").css("width", progressPercentPrompts + "%");
    $("#progress-prompts-cur").text(progressCurPrompt);
    $("#progress-prompts-total").text(progressTotalPrompts);
}

function generationProgress() {
    $.ajax({
        type: 'GET',
        url: '/api/images/progress',
        success: function(data) {
            // console.log(data);
            dataRefreshComplete(data);
            setTimeout(generationProgress, 250);
        },
        error: function(error){
            console.log("Error:");
            console.log(error);
            setTimeout(generationProgress, 250);
        }
  });
}

$(document).ready(function() {
    const params = new URLSearchParams(window.location.search);
    const encodedUrl = params.get('backUrl');

    if(encodedUrl != undefined)
        backUrl = decodeURIComponent(encodedUrl);

    setTimeout(generationProgress, 250);
});
