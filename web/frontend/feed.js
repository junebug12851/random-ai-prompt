const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      const img = entry.target;
      const src = img.getAttribute('data-src');
      img.setAttribute('src', src);
      img.classList.remove('lazy-load');
      observer.unobserve(img);
  }
});
});

function imagesChanged() {
    const images = document.querySelectorAll('.lazy-load');

    images.forEach((img) => {
      observer.observe(img);
  });
}

function clearImages() {
    const images = document.querySelectorAll('.lazy-load');

    images.forEach((img) => {
        try {
          observer.unobserve(img);
      } catch(err) {}
    });

    // Clear gallery
    $("#page-gallery").empty();
}

function getGalleryEl(prompt, imgSrc, width, height, name) {

    return `
        <a href="/single?name=${name}" rel="noopener noreferrer" class="gallery-el wide-${width} tall-${height}">
            <div class="overlay">
                <p>${prompt}</p>
            </div>
            <img data-src="${imgSrc}" class="gallery-img lazy-load"/>
        </a>
    `;
}

function processImageFeed(files) {

    clearImages();

    for(let i = 0; i < files.length; i++) {

        // Get width and height in increments of 512
        let width = files[i].width;
        let height = files[i].height;

        // Use upscale dimensions if there are ones
        // this only happens if the file is upscaled and the original is asked to
        // not be saved
        if(files[i].upscaleWidth != undefined)
            width = files[i].upscaleWidth;

        if(files[i].upscaleHeight != undefined)
            height = files[i].upscaleHeight;

        // Convert to aspect rato
        let ar = width / height;
        
        // Determin col and row span
        if(ar >= 2.00) {
            width = 2;
            height = 1;
        }
        else if(ar <= 0.50) {
            width = 1;
            height = 2;
        }
        else {
            width = 1;
            height = 1;
        }

        $("#page-gallery").append(
            getGalleryEl(
                files[i].prompt.substring(0, 100) + "...",
                files[i].imgPath,
                width,
                height,
                files[i].name
            )
        );
    }

    imagesChanged();
}

function loadImageFeed() {
    $.ajax({
        url: "/api/images/feed",
        type: "GET",
        dataType: "json",
        success: function(data){
            processImageFeed(data);
        },
        error: function(error){
            console.log("Error:");
            console.log(error);
        }
    });
}

function loadSearchQuery(query) {
    $.ajax({
        type: 'GET',
        url: '/api/images/query',
        data: {query},
        success: function(data) {
            processImageFeed(data);
        },
        error: function(error){
            console.log("Error:");
            console.log(error);
        }
  });
}

function performSearch() {
    // get query and trim it
    let text = $('#page-search').val();

    // If it's completely empty, refresh feed, otherwise, send a query to the backend
    if(text == "")
        loadImageFeed();
    else
        loadSearchQuery(text)
}

function searchboxKeyPress(event) {
    const keycode = (event.keyCode ? event.keyCode : event.which);

   if(keycode != '13')
        return;

    performSearch();
}

function updateSearchSuggestion() {
   $.ajax({
        type: 'GET',
        url: '/api/images/search-suggestion',
        success: function(data) {
            $('#page-search').attr('placeholder', data);
        },
        error: function(error){
            console.log("Error:");
            console.log(error);
        }
  });
}

function performRandomSearch() {

    // Get random placeholder text
    let text = $('#page-search').attr('placeholder');

    // Set it as search text
    $('#page-search').val(text);

    // Request new placeholder text
    updateSearchSuggestion();

    // Perform search
    loadSearchQuery(text);
}

function homeFeed() {
    $('#page-search').val("");
    loadImageFeed();
}

function updateStats() {

    $.ajax({
        type: 'GET',
        url: '/api/images/stats',
        success: function(data) {
            const keywordCount = data._total.keywords;
            const fileCount = data._total.files;

            $("#keyword-count").text(keywordCount);
            $("#image-count").text(fileCount);
        },
        error: function(error){
            console.log("Error:");
            console.log(error);
        }
  });
}

// Set the interval to run every 30 seconds
setInterval(function() {

  updateSearchSuggestion();

}, 15 * 1000);

$(document).ready(function() {

    const params = getUrlParameters();
    if(params.search != undefined) {
        loadSearchQuery(params.search);
        $('#page-search').val(params.search);
    }
    else
        loadImageFeed();

    updateSearchSuggestion();
    updateStats();

    $('#page-search').keypress(searchboxKeyPress);
    $('#random').click(performRandomSearch);
    $('#search').click(performSearch);
    $('#home').click(homeFeed);
});
