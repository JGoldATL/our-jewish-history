/* Shared quiz helpers (F-035). The one place that decides which questions are approved and how an answer is worded.
   quiz.js and quizprompt.js (the three-card pop-up) both use it, so the rules are not written twice. */
(function(){
'use strict';
var LETTERS='ABCDE';
/* Year labels: bare years for the Common Era (1654), BCE kept on BCE years, never a thousands comma (2000 BCE). */
function fy(y){return y<0?(-y)+' BCE':''+y;}
/* Production rule: only Approved questions are dealt. Drafts can be tested with ?drafts=1, and a preview build whose questions are all still
   drafts shows them too (marked in the footer). A public build never contains drafts at all. */
function pickQuestions(all,meta,search){
  var approved=all.filter(function(q){return q.status==='approved';});
  var flag=/[?&]drafts=1\b/.test(search||'');
  var preview=meta&&meta.mode==='preview';
  var useDrafts=flag||(preview&&approved.length===0);
  return {list:useDrafts?all:approved,drafts:useDrafts&&all.some(function(q){return q.status!=='approved';})};
}
/* Questions that can be answered with one tap: a lettered choice. Ordering questions ("Tap them from earliest to latest") are left to the full quiz. */
function oneTap(q){return !!q&&q.correct!=='order'&&LETTERS.indexOf(q.correct)>=0&&Array.isArray(q.choices)&&q.choices.length>=2&&q.choices.length<=LETTERS.length&&!!q.choices[LETTERS.indexOf(q.correct)];}
/* The plain verdict, used when no tagged line applies. Returns plain text (the caller escapes it) and, for a wrong answer, the date line. */
function verdict(q,ok,pick){
  if(ok)return {text:'You got it.',date:''};
  var answer=q.choices[LETTERS.indexOf(q.correct)];
  return {text:'Not quite. You picked “'+q.choices[pick]+'.” The answer is “'+answer+'.”',date:'In Jewish history: '+q.jewishEvent+', '+fy(q.jewishYear)+'.'};
}
window.OJJQuiz={LETTERS:LETTERS,fy:fy,pickQuestions:pickQuestions,oneTap:oneTap,verdict:verdict};
})();
