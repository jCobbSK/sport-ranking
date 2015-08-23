var setupTimers = function() {
  function calculateTime() {
    $('.timed-var').each(function(){
      var time = $(this).data('time');
      $(this).html(moment(time).fromNow());
    });
  }

  calculateTime();
  setInterval(function(){
    calculateTime();
  }, 5000);
}
