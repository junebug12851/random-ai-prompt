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

function processImageFeed(files) {

    clearImages();

    for(let i = 0; i < files.length; i++) {

        let width = Math.round(files[i].width / 512);
        let height = Math.round(files[i].height / 512);
        
        // Determine aspect ratio
        if(width > height) {
            width = 2;
            height = 1;
        }
        else if(height > width) {
            width = 1;
            height = 2;
        }
        else if((width > 1) && (height > 1)) {
            width = 2;
            height = 2;
        }
        else {
            width = 1;
            height = 1;
        }

        $("#page-gallery").append(`<img data-src="${files[i].imgPath}" class="gallery-img wide-${width} tall-${height} lazy-load"/>`);
    }

    imagesChanged();
}

function loadImageFeed() {
    $.ajax({
        url: "/images/feed",
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
        url: '/images/query',
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

function performSearch(event){
   const keycode = (event.keyCode ? event.keyCode : event.which);

   if(keycode != '13')
        return;

    // get query and trim it
    let text = $('#page-search').val();

    // If it's completely empty, refresh feed, otherwise, send a query to the backend
    if(text == "")
        loadImageFeed();
    else
        loadSearchQuery(text)
}

function initiateReindex() {
    clearImages();
    
    $.ajax({
        type: 'GET',
        url: '/images/re-index',
        success: function(data) {
            loadImageFeed();
        },
        error: function(error){
            console.log("Error:");
            console.log(error);
        }
  });
}

$(document).ready(function() {
    loadImageFeed();
    $('#page-search').keypress(performSearch);
    $('#re-index').click(initiateReindex);
});
