// ==UserScript==
// @name        /bant/ Flags
// @namespace   BintFlegs
// @description More flags for r/banter
// @include     http*://boards.4chan.org/bant/*
// @include     http*://archive.nyafuu.org/bant/*
// @include     http*://archived.moe/bant/*
// @include     http*://thebarchive.com/bant/*
// @include     http*://nineball.party/*
// @exclude     http*://boards.4chan.org/bant/catalog
// @exclude     http*://archive.nyafuu.org/bant/statistics/
// @exclude     http*://archived.moe/bant/statistics/
// @exclude     http*://thebarchive.com/bant/statistics/
// @version     1.5.1
// @grant       GM_xmlhttpRequest
// @grant       GM_getValue
// @grant       GM_setValue
// @grant       GM.setValue
// @grant       GM.getValue
// @grant       GM.xmlHttpRequest
// @run-at      document-idle
// @icon        https://flags.plum.moe/flags/0077.png
// @updateURL    https://flags.plum.moe/bantflags.meta.js
// @downloadURL  https://flags.plum.moe/bantflags.user.js
// ==/UserScript==

// (C) Copyright 2019 C-xC-c <boku@plum.moe>
// This file is part of /bant/ Flags.
// /bant/ Flags is licensed under the GNU AGPL Version 3.0 or later.
// see the LICENSE file or <https://www.gnu.org/licenses/>

// Change this if you want verbose debuging information in the console.
const debugMode = false;

const isGM4 = typeof GM_setValue === 'undefined';
const setValue = isGM4 ? GM.setValue : GM_setValue;
const getValue = isGM4 ? GM.getValue : GM_getValue;
const xmlHttpRequest = isGM4 ? GM.xmlHttpRequest : GM_xmlhttpRequest;

//
// DO NOT EDIT ANYTHING IN THIS SCRIPT DIRECTLY - YOUR FLAGS SHOULD BE CONFIGURED USING THE FLAG SELECT
//
const version = 2; // Breaking changes.
const back_end = 'https://flags.plum.moe/';
const api_flags = 'api/flags';
const flag_dir = 'flags/';
const api_get = 'api/get';
const api_post = 'api/post';
const namespace = 'BintFlegs';

// If you increase this the server will ignore your post.
const max_flags = 30;

let regions = []; // The flags we have selected.
let postNrs = []; // all post numbers in the thread.
let board_id = ""; // The board we get flags for.
let flagsLoaded = false;
//
// DO NOT EDIT ANYTHING IN THIS SCRIPT DIRECTLY - YOUR FLAGS SHOULD BE CONFIGURED USING THE FLAG SELECT
//

// Test unqiue CSS paths to figure out what board software we're using.
const software = {
  yotsuba: window.location.host === 'boards.4chan.org',
  nodegucaDoushio: document.querySelector('b[id="sync"], span[id="sync"]') !== null,
  foolfuuka: document.querySelector('div[id="main"] article header .post_data') !== null
};

/** Wrapper around Object.assign and document.createElement
 * @param {string} element - The HTML Element to create.
 * @param {object} source - The properties to assign to the element. 
 * @returns {object} The HTML tag created */
const createAndAssign = (element, source) => Object.assign(document.createElement(element), source);

const toggleFlagButton = state => document.getElementById('append_flag_button').disabled = state === 'off' ? true : false;

/** Add a stylesheet to the head of the document.
 * @param {string} css - The CSS rules for the stylesheet. 
 * @returns {object} The style element appended to the head */
const addGlobalStyle = css => document.head.appendChild(createAndAssign('style', {
  type: 'text/css',
  innerHTML: css
}));

/** Write extra information to the console if debugMode is set to true.
 * @param {string} text - The text to write to the console. */
function debug(text) {
  if (debugMode) {
    console.log('[BantFlags] ' + text);
  }
}

/** Wrapper around GM_xmlhttpRequest.
 * @param {string} method - The HTTP method (GET, POST).
 * @param {string} url - The URL of the request.
 * @param {string} data - text for the form body.
 * @param {Function} func - The function run when we recieve a response. Response data is sent directly to it. */
const makeRequest = ((method, url, data, func) => {
  xmlHttpRequest({
    method: method,
    url: url,
    data: data,
    headers: { "Content-Type": 'application/x-www-form-urlencoded' },
    onload: func
  });
});

/** Itterate over selected flags are store them across browser sessions.*/
function saveFlags() {
  regions = [];
  let selectedFlags = document.getElementsByClassName("bantflags_flag");

  for (var i = 0; i < selectedFlags.length; i++) {
    regions[i] = selectedFlags[i].title;
  }

  setValue(namespace, regions);
}

/** Add a flag to our selection.
 * @param {string} flag - The flag to add to our selection. If no value is passed it takes the current value from the flagSelect. */
function setFlag(flag) {
  let UID = Math.random().toString(36).substring(7);
  let flagName = flag ? flag : document.querySelector('#flagSelect input').value;
  let flagContainer = document.getElementById('bantflags_container');

  flagContainer.appendChild(createAndAssign('img', {
    title: flagName,
    src: back_end + flag_dir + flagName + '.png',
    id: UID,
    className: 'bantflags_flag'
  }));

  if (flagContainer.children.length >= max_flags) {
    toggleFlagButton('off');
  }

  document.getElementById(UID).addEventListener("click", (e) => {
    flagContainer.removeChild(e.target);
    toggleFlagButton('on');
    saveFlags();
  });

  if (!flag) { // When we add a flag to our selection, save it for when we reload the page.
    saveFlags();
  }
}

/** Create flag button and initialise our selected flags */
function init() {
  let flagsForm = createAndAssign('div', {
    className: 'flagsForm',
    innerHTML: '<span id="bantflags_container"></span><button type="button" id="append_flag_button" title="Click to add selected flag to your flags. Click on flags to remove them. Saving happens automatically, you only need to refresh the pages that have an outdated flaglist on the page."><<</button><button id="flagLoad" type="button">Click to load flags.</button><div id="flagSelect" ><ul class="hide"></ul><input type="button" value="(You)" onclick=""></div>'
  });

  // Where do we append the flagsForm to?
  if (software.yotsuba) { document.getElementById('delform').appendChild(flagsForm); }
  if (software.nodegucaDoushio) { document.querySelector('section').append(flagsForm); } // As posts are added the flagForm moves up the page. Could we append this after .section?

  for (var i in regions) {
    setFlag(regions[i]);
  }

  document.getElementById('append_flag_button').addEventListener('click',
    () => flagsLoaded ? setFlag() : alert('Load flags before adding them.'));

  document.getElementById('flagLoad').addEventListener('click', makeFlagSelect, { once: true });
}

/** Get flag data from server and fill flags form. */
function makeFlagSelect() {
  makeRequest(
    "GET",
    back_end + api_flags,
    "version=" + encodeURIComponent(version),
    function (resp) {
      debug('Loading flags.');
      if (resp.status !== 200) {
        return;
      }

      let flagSelect = document.getElementById('flagSelect');
      let flagList = flagSelect.querySelector('ul');
      let flagInput = flagSelect.querySelector('input');
      let flags = resp.responseText.split('\n');

      for (var i = 0; i < flags.length; i++) {
        let flag = flags[i];
        flagList.appendChild(createAndAssign('li', {
          innerHTML: '<img src="' + back_end + flag_dir + flag + '.png" title="' + flag + '"> <span>' + flag + '</span>'
        }));
      }

      flagSelect.addEventListener('click', (e) => {
        listItem = e.target.nodeName === 'LI' ? e.target : e.target.parentNode; // So we can click the flag image and still select the flag.
        if (listItem.nodeName === 'LI') {
          flagInput.value = listItem.querySelector('span').innerHTML;
        }
        flagList.classList.toggle('hide');
      });

      document.getElementById('flagLoad').style.display = 'none';
      document.querySelector('.flagsForm').style.marginRight = "200px"; // Element has position: absolute and is ~200px long.
      flagSelect.style.display = 'inline-block';
      flagsLoaded = true;
    });
}

/** add all of thhe post numbers on the page to postNrs.
 * @param {string} selector - The CSS selector who's id is the post number. */
function getPosts(selector) {
  let posts = document.querySelectorAll(selector);

  for (var i = 0; i < posts.length; i++) {
    let postNumber = software.yotsuba
      ? posts[i].id.replace('pc', '') // Fuck you 4chan.
      : posts[i].id;
    postNrs.push(postNumber);
  }
  debug(postNrs);
}

/** Take the response from resolveRefFlags and append flags to their respective post numbers.
 * @param {XMLHttpRequest} response - The response data from resolveRefFlags. */
function loadFlags(response) {
  debug('JSON: ' + response.responseText);
  var jsonData = JSON.parse(response.responseText);

  Object.keys(jsonData).forEach(function (post) {

    // Get the post header with a CSS selector. Different for each board software.
    var flagContainer;
    if (software.nodegucaDoushio) { flagContainer = document.querySelector('[id="' + post + '"] header'); }
    if (software.yotsuba) { flagContainer = document.querySelector('[id="pc' + post + '"] .postInfo  .nameBlock'); }
    if (software.foolfuuka) { flagContainer = document.querySelector('[id="' + post + '"] .post_data .post_type'); }

    let flags = jsonData[post];
    if (flags.length > 0) {
      console.log('[BantFlags] Resolving flags for >>' + post);

      for (var i = 0; i < flags.length; i++) {
        let flag = flags[i];

        let newFlag = createAndAssign('a', {
          innerHTML: '<img src="' + back_end + flag_dir + flag + '.png" title="' + flag + '"> ',
          className: 'bantFlag',
          target: '_blank'
        });

        if (software.foolfuuka) {
          newFlag.style = 'padding: 0px 0px 0px ' + (3 + 2 * (i > 0)) + 'px; vertical-align:;display: inline-block; width: 16px; height: 11px; position: relative;';
        }

        if (software.nodegucaDoushio) {
          newFlag.title = flag;
        }

        flagContainer.append(newFlag);

        console.log('\t -> ' + flag);
      }
    }
  });

  postNrs = [];
}

/** Get flags from the database using values in postNrs and pass the response on to onFlagsLoad */
function resolveFlags() {
  debug('Board is: ' + board_id);
  makeRequest(
    'POST',
    back_end + api_get,
    'post_nrs=' + encodeURIComponent(postNrs) + '&board=' + encodeURIComponent(board_id) + '&version=' + encodeURIComponent(version),
    function (resp) {
      if (resp.status !== 200) {
        console.log('[bantflags] Couldn\'t load flags. Refresh the page.');
        return;
      }
      loadFlags(resp);
    }
  );
}

function main() {
  if (!regions) { // Should only be called before you set flags for the first time.
    regions = [];
    window.confirm('[BantFlags]: No Flags detected.\nIf this is your first time running bantflags, look for the "Click to load flags." button at the bottom right of the thread, then select your flag and press the ">>" button.');
  }

  // See Docs/styles.css
  addGlobalStyle('.flagsForm{float: right; clear: right; margin: 20px 10px;} #flagSelect{display:none;} .bantflags_flag{padding: 1px;} [title^="Romania"]{ position: relative; animation: shakeAnim 0.1s linear infinite;} @keyframes shakeAnim{ 0% {left: 1px;} 25% {top: 2px;} 50% {left: 1px;} 75% {left: 0px;} 100% {left: 2px;}} #flagSelect ul {list-style-type: none;padding: 0;margin-bottom: 0;cursor: pointer;bottom: 100%;height: 200px;overflow: auto;position: absolute;width:200px;background-color:#fff}#flagSelect ul li {display: block;}#flagSelect ul li:hover {background-color: #ddd;}#flagSelect {position: absolute;}#flagSelect input {width: 200px;} #flagSelect .hide {display: none;}#flagSelect img {margin-left: 2px;}');

  // We get flags using different selectors, and we need to align them differently.
  if (software.yotsuba) {
    debug('4chan');
    getPosts('.postContainer');

    addGlobalStyle('.bantFlag {padding: 0px 0px 0px 5px; vertical-align:;display: inline-block; width: 16px; height: 11px; position: relative;} .flag{top: 0px;left: -1px}');
    init();
  }

  if (software.nodegucaDoushio) {
    debug('Nineball');
    getPosts('section[id], article[id]');

    addGlobalStyle('.bantFlag {cursor: default} .bantFlag img {pointer-events: none;}');
    init();
  }

  if (software.foolfuuka) {
    debug('FoolFuuka');
    getPosts('article[id]');

    addGlobalStyle('.bantFlag{top: -2px !important;left: -1px !important}');
  }

  board_id = window.location.pathname.split('/')[1];
  resolveFlags();
}

if (isGM4) {
  (async () => {
    regions = await getValue(namespace);
    main();
  })();
}
else {
  regions = getValue(namespace);
  main();
}

if (software.yotsuba) {
  const GetEvDetail = e => e.detail || e.wrappedJSObject.detail;

  const postFlags = post_nr => makeRequest(
    'POST',
    back_end + api_post,
    'post_nr=' + encodeURIComponent(post_nr) + '&board=' + encodeURIComponent(board_id) + '&regions=' + encodeURIComponent(regions) + '&version=' + encodeURIComponent(version),
    func = resp => debug(resp.responseText));

  // Send flags to the backend when we makle a post. Top is 4chanX, bottom is native extension.
  document.addEventListener('QRPostSuccessful', e => postFlags(e.detail.postID), false);
  document.addEventListener('4chanQRPostSuccess', e => postFlags(GetEvDetail(e).postId), false);

  // I need to look at these.
  document.addEventListener('ThreadUpdate', function (e) {
    var evDetail = GetEvDetail(e);
    var evDetailClone = typeof cloneInto === 'function' ? cloneInto(evDetail, unsafeWindow) : evDetail;

    //ignore if 404 event
    if (evDetail[404] === true) {
      return;
    }

    evDetailClone.newPosts.forEach(function (post_board_nr) {
      var post_nr = post_board_nr.split('.')[1];
      postNrs.push(post_nr);
    });

    resolveFlags();
  }, false);

  document.addEventListener('4chanThreadUpdated', function (e) {
    var evDetail = GetEvDetail(e);
    let threadID = window.location.pathname.split('/')[3];
    let postsContainer = Array.prototype.slice.call(document.getElementById('t' + threadID).childNodes);
    let lastPosts = postsContainer.slice(Math.max(postsContainer.length - evDetail.count, 1)); //get the last n elements (where n is evDetail.count)

    lastPosts.forEach(function (post_container) {
      var post_nr = post_container.id.replace('pc', '');
      postNrs.push(post_nr);
    });

    resolveFlags();
  }, false);
}

if (software.nodegucaDoushio) {
  // This is poking at the mutations made on the page to figure out what happened and thus what actions to take.
  // There is full support for nodeguca but I don't have a Doushio board I feel comfortable spamming to ensure it works properly there. There is at least partial support.
  new MutationObserver(function (mutations) {
    mutations.forEach(function (mutation) {
      if (mutation.addedNodes.length > 0) { // A post was added.
        var firstAddedNode = mutation.addedNodes[0].nodeName;

        // Enter a thread or change boards. Checks for when a post is added while in the index.
        if (mutation.target.nodeName === 'THREADS' && firstAddedNode !== 'HR' && firstAddedNode !== 'SECTION') {
          board_id = window.location.pathname.split('/')[1];
          setTimeout(getPosts('section[id], article[id]'), 2000);
          resolveFlags();
          init();
        }

        // You post.
        if (firstAddedNode === 'HEADER') {
          let data = 'post_nr=' + encodeURIComponent(mutation.target.id) + '&board=' + encodeURIComponent(board_id) + '&regions=' + encodeURIComponent(regions) + '&version=' + encodeURIComponent(version);
          makeRequest(
            'POST',
            back_end + api_post,
            data,
            function () {
              postNrs.push(mutation.target.id);
              resolveFlags();
            });
        }

        // Someone else posts. Checks to see if you're hovering over a post.
        if (firstAddedNode === 'ARTICLE' && mutation.target.nodeName !== "BODY" && mutation.target.id !== 'hover_overlay') {
          postNrs.push(mutation.addedNodes[0].id);
          setTimeout(resolveFlags, 1500);
        }
      }
    });
  }).observe(document.body, { childList: true, subtree: true });
}
