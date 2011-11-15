/*
    This file is part of Vosbox.

    Vosbox is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    Vosbox is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with Foobar.  If not, see <http://www.gnu.org/licenses/>.

    Vosbox copyright Callan Bryant 2011 <callan.bryant@gmail.com>
*/

/*
TODO: full keyboard interface support (arrows to nav results etc)
TODO: oiplayer? (flash fallback...)
TODO: compress when dev is almost done
*/

searcher = new Object();
player = new Object();

// jQuery will fire this callback when the DOM is ready
$(function ()
{
	if(!$.browser.webkit)
	{
		$('body').html('For now only webkit browsers are supported. <a href="http://www.google.com/chrome/">Chrome</a> is good.');
		return;
	}

	if($.browser.msie && (parseInt($.browser.version) < 9) )
	{
		alert('Update your browser, please');
		return;
	}

	// make the player vanish instantly, before fading everything in
	player.init();
	searcher.init();
});

searcher.init = function ()
{
	//$('#search').val(searcher.placeholder);
	// search focus now decided by player
	//$('#search').focus();

	// ctrl+f to focus search
	$(document).bind('keydown', 'ctrl+f', function (){
		$('#search').focus().val('');
	});

	// f to focus search
	$('*').not('#search').bind('keyup', 'f', function (){
		$('#search').focus().select();
	});

	// CTRL+A to add all results to playlist
	$(document).bind('keydown','ctrl+a',searcher.enqueueAll);
	$('#enqueueAll').click(searcher.enqueueAll);

	// clear on focus TODO -- focus, not click
	$('#search').click(function (){
		$(this).select();
	});

	// override form submit
	$('#searcher form').submit(false);
	$('#search').change(searcher.search);

	$('#searcher .message').show().text('To begin, search for music in the box above');
}

searcher.search = function ()
{
	$.ajax(
	{
		data:{keywords:$('#search').val()},
		url: "search.php",
		success: searcher.showResults
	});

	// reset results area
	$('#searchResults').empty().scrollTop(0);
	$('#searcher .message').show().text('Searching...');

	// when used as a callback, replace the default action
	return false;
}

// given an array of nodes, display them
searcher.showResults = function (results)
{
	if (results.error)
	{
		$('#searcher .message').show().text(results.error);
		return;
	}

	// playlist is empty, successful search: tell user what to do next
	if (results.length && !$('#playlist *').length)
		$('#player .message').hide().fadeIn().text('Click a result to add it to this playlist');

	// remove the message
	$('#searcher .message').hide();

	if (results.length)
		// results found
		for (var i in results)
			searcher.addResult(results[i]);
	else
		$('#searcher .message').show().text('No results found');
}

searcher.addResult = function (result)
{
	// add the HTML
	item = $('<div class="item">'+
	'<div class="artist tag">'+result.artist+'</div><div class="title">'+result.title+'</div>'+
	'<div class="album tag">'+result.album+'</div></div>');

	// attach metadata
	item.data('meta',result);

	// add to search results area
	item.appendTo('#searchResults');

	// click to enqueue
	item.click(function (){
		meta = $(this).data('meta');
		player.enqueue(meta);
		$(this).remove();
	});

	// click to play immediately
	item.rightClick(function (){
		meta = $(this).data('meta');
		player.enqueue(meta,true);
		$(this).remove();
	});
}

// enqueue everything currently in the search result area
searcher.enqueueAll = function ()
{
	$('#searchResults .item').each(function (){
		player.enqueue($(this).data('meta'));
	});

	// stop the playlist from scolling to the bottom
	$('#playlist').stop();

	// remove items from playlist
	$('#searchResults').empty();	
	$('#searcher .message').show().text('All search results added!');

	// allow override if being used as callback
	return false;
}

// modify CSS to make search pane obscure player, fading everything in
// without player visible. This allows CSS to define the full view,
// using pure JS to handle the dynamic UI.
player.init = function ()
{
	// HTML5 audio player, not part of the DOM
	player.audio = document.createElement('audio');

	player.state = 'stopped';

	// remove the pause button
	//$('#pause').hide();

	// add a watcher to set the progress bar
	window.setInterval(function (){
		// calculate percentage of time passed on current song
		var percent = 100*player.audio.currentTime/player.audio.duration;

		// set loader if appropiate
		if (player.state == 'playing' && player.audio.currentTime == 0)
		{
			// must be loading
			$('#controls .progress .bar').hide();
			$('#controls .progress').css('background','url("load.gif")')
		}
		else
		{
			// not loading, playing properly	
			$('#controls .progress .bar').show();
			$('#controls .progress').css('background','white')
		}

		// set progress
		$('#controls .progress .bar').css('width',percent+'%');
	},100);

	// add event to advance the playlist on song completion
	player.audio.addEventListener('ended',player.next);

	// controls: events
	$('#next').click(player.next);
	$('#prev').click(player.prev);
	$('#pause,#play').click(player.playPause);

	$('#empty').click(player.empty);
	$('#share').click(player.sharePlaylist);
	
	$('#downloadSelected').click(player.downloadSelected);

	$('#shuffle').click(function()
	{
		$('#playlist').shuffle();
	});

	$(document).bind('keydown','ctrl+s',player.sharePlaylist);

	// dynamic (live) events for playlist items
	//$('#playlist .item').live('click',doSomething);

	// seek
	$('#controls .progress').click(function(e){
		// translate X click pos to time in song
		var offset = e.pageX - $(this).offset().left;
		var proportion = offset/$(this).width();
		var newTime = proportion*player.audio.duration;

		// set the new time. Note that, for some unknown reason,
		// this does not always work...
		player.audio.currentTime = newTime;
	});
	

	// if not searching, up and down are prev and next
	$(document).bind('keydown','right',player.next);
	$(document).bind('keydown','left',player.prev);
	$(document).bind('keydown','down',player.next);
	$(document).bind('keydown','up',player.prev);
	$(document).bind('keydown','space',player.playPause);

	// click to search on nowPlaying
	$('#nowPlaying .artist').click(function()
	{
		var query = $(this).text();
		$('#search').val(query);
		searcher.search();
	});

	$('#albumArt,#nowPlaying .album').click(function(){
		var query = $('#nowPlaying .artist').text()+' - '+$('#nowPlaying .album').text();
		$('#search').val(query);
		searcher.search();		
	});

	// click title to download
	$('#nowPlaying .title').click(function(){
		window.open(player.audio.src);
	});

	$('#stop').click(player.stop);
	$(document).bind('keydown','esc',player.stop);
	$(document).bind('keydown','d',player.downloadSelected);

	// load a playlist by ID from hash in URL
	if (document.location.hash)
		// load the playlist id given, without the hash
		player.loadPlaylist( document.location.hash.slice(1) );
	// try to resume the old playlist
	else if(!player.resume())
		// if not, the user will probably want to search immediately for
		// new songs. So include them.
		$('#search').focus();

	window.onhashchange = function(){
		// load the playlist id given, without the hash
		player.loadPlaylist( document.location.hash.slice(1) );
	}


	// bind event to hibernate playlist
	window.onbeforeunload = player.hibernate;
}

// enqueue an item using the metadata
player.enqueue = function (meta,playNow)
{
	// create an element to represent the item
	item = $('<div class="item">'+
	'<div class="artist">'+meta.artist+'</div><div class="title">'+meta.title+'</div>'+
	'<div class="album">'+meta.album+'</div></div>');

	// attach metadata to the item
	item.data('meta',meta);

	// add event to select on click
	item.click(player.selectThis);

	// add event to remove on right click
	item.rightClick(function()
	{
		if (!$(this).hasClass('selected'))
			$(this).remove();
	});

	// attach it to the DOM, playlist
	if (playNow)
		// right after the currently playing item
		item.hide().fadeIn().insertAfter('#playlist > div.selected');
	else
		// to the bottom
		item.hide().fadeIn().appendTo('#playlist');

	// make sure there is no message
	$('#player .message').hide();

	// play the item on first add (to empty playlist) or add to idle playlist
	// or playnow
	if (player.state == 'stopped' || !$('#playlist').length || playNow)
	{
		// each will select just that item...
		item.each(player.selectThis);
		player.play();
	}
	else
	{
		var length = $("#playlist")[0].scrollHeight;
	        $("#playlist").stop().animate({scrollTop:length});
	}
}

player.downloadSelected = function(){
	if (!$('#playlist .item').length)
	{
		$('#player .message').hide().fadeIn().text('Nothing to download yet!');
		return
	}

	var id = $('#playlist .selected').data('meta').id;
	document.location = 'download.php?id='+id;
}


// select item on the playlist, playing if appropiate
//  (as an element in 'this' context)
player.selectThis = function ()
{
	// highlight the item as currently playing, clearing others
	$('#playlist .item').removeClass('selected');
	$(this).addClass('selected');

	// scroll the item on the playlist into view (around half way down list)
	// find position relative to the top of the list, remove half the
	// height of the list.
	var offset = $('#playlist .selected').offset().top 
		+ $('#playlist').scrollTop() 
		- $('#playlist').offset().top
		- $('#playlist').height()/4;


	// update the meta area with album art etc. Forcing not-null
	// so fields are always updated
	var meta = $(this).data('meta');
	$('#nowPlaying .title').text(String(meta.title));
	$('#nowPlaying .album').text(String(meta.album));
	$('#nowPlaying .artist').text(String(meta.artist));
	$('#nowPlaying .year').text(String(meta.year));

	// albumArt
	if (meta.albumArtId)
		$('#albumArt').html('<img src="albumArt.php?id='+meta.albumArtId+'" />');
	else
		$('#albumArt').empty();

	// play the file
	player.audio.setAttribute('src', 'download.php?id='+meta.id);

	//$('#playlist').scrollTop(offset);
	// animate to offset, clearing any other previous, possibly conflicting
	// animations
	$('#playlist').stop().animate({scrollTop:offset});

	// play it if appropiate (it always is!)
	//if (player.state == 'playing')
		player.play();
}

// play the item currently selected on the playlist, from start
player.play = function ()
{
	if (!player.audio.src)
		return;

	player.state = 'playing';

	// make sure the controls are set right
	$('#play').hide();
	$('#pause').show();

	player.audio.play();
}

// select the next song, play if playing already, returns false
// so can be used to override normal events
player.next = function ()
{
	var item = $('#playlist .selected').next();

	// if there is no next item, default to the first item (repeat all)
	if (!item.length)
		item = $('#playlist .item:first-child');

	item.each(player.selectThis);

	return false;
}

// select the previous song, play if playing already, returns false
// so can be used to override normal events
player.prev = function ()
{
	$('#playlist .selected').prev().each(player.selectThis);
	return false;
}

player.playPause = function ()
{
	switch (player.state)
	{
		case 'paused':
		case 'stopped':
			player.play();
		break;
		case 'playing':
			player.pause();
		break;
	}
	return false;
}

player.pause = function ()
{
			
	player.audio.pause();
	// update icon
	$('#pause').hide();
	$('#play').show();
	// update state
	player.state = 'paused';

	return false;
}

player.stop = function ()
{
	// pause it, resetting counter
	player.audio.pause();
	if (player.audio.currentTime)
		player.audio.currentTime = 0;

	// update icon
	$('#pause').hide();
	$('#play').show();

	// update state
	player.state = 'stopped';
}

// return an array of playlist objects
player.getPlaylistObjects = function ()
{
	// get an array of playlist elements
	elements = $('#playlist .item').get();

	// iterate over the elements, collecting IDs
	objects = Array();

	for (var i in elements)
		objects.push( $(elements[i]).data('meta') );

	return objects;
}

//empty playlist, reset player
player.empty = function()
{
	player.audio.src = null;
	player.stop();

	if (!$('#playlist .item').length)
	{
		$('#player .message').hide().fadeIn().text('Playlist is already empty');
		return
	}

	$('#albumArt,#nowPlaying .title,#nowPlaying .album,#nowPlaying .artist,#nowPlaying .year').empty();
	$('#albumArt img').attr('src',null);

	$('#playlist .item').css('z-index',2000).fadeOut(function(){
		$(this).remove();
	});
}

// load a playlist from the server by playlist ID
player.loadPlaylist = function(id)
{
	// set off a request for the list
	$.ajax(
	{
		data:{load:id},
		url: "playlist.php",
		type: 'POST',
		success: function(items)
		{
			if (items.error)
			{
				$('#player .message').show().text(items.error);
				return;
			}

			for (var i in items)
				player.enqueue(items[i]);

			// stop the playlist from scolling to the bottom
			$('#playlist').stop();

			// clear message
			$('#player .message').hide();
		}
	});
	// prepare playlist, bypassing fade out for messages
	$('#playlist').empty();
	player.empty();
	$('#player .message').show().text('Loading playlist...');
}

// save the current playlist on the server by posting IDs.
// informs the user of the new link containing the URL
player.sharePlaylist = function()
{
	if (!$('#playlist .item').length)
	{
		$('#player .message').hide().fadeIn().text('Nothing to share yet!');
		return
	}

	// get array of playlist ids
	var objects = player.getPlaylistObjects();
	var ids = Array();

	for (var i in objects)
		ids.push( objects[i].id );

	var baseURL = document.location.toString().replace(/#.+$/,'');

	// set off a request for the id
	$.ajax(
	{
		// include a comma separated array of IDs
		data:{save:ids.toString()},
		type: 'POST',
		url: "playlist.php",
		success: function(data)
		{
			if (data.error)
			{
				alert(data.error);
				return;
			}

			var url = baseURL+'#'+data.id;

			$('#player .message').show().html('<p>Playlist published to </p><a href="'+url+'">'+url+'</a>');
		}
	});

	
	$('#playlist').empty();
	player.empty();
	$('#player .message').show().text('Publishing playlist...');
}

// save the playlist locally
player.hibernate = function()
{
	localStorage.playlist = JSON.stringify( player.getPlaylistObjects() );
}

// load the playlist from last session
player.resume = function()
{
	// for some reason this fixes an error when using SSL ...?
	// Apparently trying to parse a null string into JSON is ILLEGAL!
	if (!localStorage.playlist)
		return false;

	var items = JSON.parse(localStorage.playlist);

	if (items.length)
	{
		for (var i in items)
			player.enqueue(items[i]);

		// stop the playlist from scolling to the bottom
		$('#playlist').stop();

		// clear message
		$('#player .message').hide();
		return true;
	}
	else
		return false;
}
