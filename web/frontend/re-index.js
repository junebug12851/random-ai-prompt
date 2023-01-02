let backUrl = "/";

function initiateReindex() {
    $.ajax({
        type: 'GET',
        url: '/api/images/re-index',
        success: function(data) {
            window.location = backUrl;
        },
        error: function(error){
            console.log("Error:");
            console.log(error);
        }
  });
}

function reindexProgress() {
    $.ajax({
        type: 'GET',
        url: '/api/images/reindex-progress',
        success: function(data) {
            // console.log(data);
            $("#progress-value").text((data.value == null) ? 0 : data.value);
            $("#end-value").text((data.total == null) ? 0 : data.total);
            $("#progress-percent").css("width", (data.total == 0) ? "100%" : (((data.value / data.total) * 100) + "%") );
            setTimeout(reindexProgress, 250);
        },
        error: function(error){
            console.log("Error:");
            console.log(error);
            setTimeout(reindexProgress, 250);
        }
  });
}

$(document).ready(function() {
    const params = new URLSearchParams(window.location.search);
    const encodedUrl = params.get('backUrl');

    if(encodedUrl != undefined)
        backUrl = decodeURIComponent(encodedUrl);

    reindexProgress();
    initiateReindex();
});
