
function whenplay(){
//    var xpvi = setTimeout("document.body.getElementById('it');", 3000);
    var time = new Date();
    if(time.getSeconds() < 30)
    {
        var begin = time.getMinutes()+0.5;
    }
    else{
        var begin = time.getMinutes()+1;
    }
    var curtime = time.getMinutes()*60000+time.getSeconds()*1000+time.getMilliseconds(); //retreives current amount of minutes. TODO: server/Network time would be nice!
    var delay = 60000*begin-curtime; //calculates time until start time
    setTimeout("media.play();", delay); //delays video playing until start time
}
whenplay();
