function resultsLoaded(results) {

    if(results.prompts.length > 0) {
        $("#prompts-title").show();
        $("#prompts").show();
    }

    for(let i = 0; i < results.prompts.length; i++)
        $("#prompts").append(`<p class="prompt">${results.prompts[i]}</p>`);

    if(results.images.length > 0) {
        $("#images-title").show();
        $("#images").show();
    }

    for(let i = 0; i < results.images.length; i++) {
        if(results.images[i].link == undefined)
            continue;

        $("#images").append(`<a href="${results.images[i].link}" class="image"><img src="${results.images[i].image}"/></a>`);
    }

    if(results.prompts.length == 0 && results.images.length == 0)
        $("#no-results").show();
}

function loadResults() {
    $.ajax({
        url: "/api/results",
        type: "GET",
        dataType: "json",
        success: function(data){
            resultsLoaded(data);
        },
        error: function(error){
            console.log("Error:");
            console.log(error);
        }
    });
}

function makeArt() {

    // Get saved prompt, if any
    let pageSearch = localStorage.getItem('prompt');
    if(pageSearch == undefined || pageSearch == null)
        pageSearch = "";

    $.ajax({
        type: 'POST',
        url: `/api/generate`,
        data: JSON.stringify({value: pageSearch}),
        contentType: 'application/json',
        success: function(data) {
            
        },
        error: function(error){
            console.log("Error:");
            console.log(error);
        }
  });

    displayProgress(true);
}

$(document).ready(function() {
    loadResults();

    $('#make-art').click(makeArt);
});
