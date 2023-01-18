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

    // If we're upscaling, then proceed to show upscaling progress window
    if(data.progressUpscaling) {
        const encodedBackUrl = encodeURIComponent(backUrl);
        const params = new URLSearchParams({ backUrl: encodedBackUrl });
        window.location = `/upscale-progress?${params}`;
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

let loadedPrompts = 0;
let loadedImages = 0;

async function loadResults() {

    // Get results
    const results = await ajaxGet("/api/progress-results");

    // Stop if invalid
    if(results == null || results == undefined)
        return;

    if(results.prompts.length > 0) {
        $("#prompts-title").show();
        $("#prompts").show();
    }

    for(let i = loadedPrompts; i < results.prompts.length; i++,loadedPrompts++) {
        $("#prompts").append(`<p class="prompt">${results.prompts[i]}</p>`);
    }

    if(results.images.length > 0) {
        $("#images-title").show();
        $("#images").show();
    }

    for(let i = loadedImages; i < results.images.length; i++,loadedImages++) {
        if(results.images[i] == undefined)
            continue;

        $("#images").append(`<a href="${results.images[i]}" class="image" rel="noopener noreferrer" target="_blank"><img src="${results.images[i]}"/></a>`);
    }

    setTimeout(loadResults, 250);
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

function toggleDetailedProgress() {
    $("#minimal-progress-bar").toggle();
    $("#expanded-progress-bar").toggle();

    if($("#minimal-progress-bar").is(":visible"))
        $(".minimal-expand").text("Expand Progress");
    else
        $(".minimal-expand").text("Collapse Progress");
}

$(document).ready(function() {
    const params = new URLSearchParams(window.location.search);
    const encodedUrl = params.get('backUrl');

    if(encodedUrl != undefined)
        backUrl = decodeURIComponent(encodedUrl);

    setTimeout(generationProgress, 250);
    setTimeout(loadResults, 250);

    $(".minimal-expand").click(toggleDetailedProgress);
});
