<?php
/**
 * Silverline Beta-Feedback (included from silverline-api.php)
 *
 * - POST /wp-json/silverline/v1/feedback  -> submit feedback (open)
 * - GET  /wp-json/silverline/v1/feedback  -> list feedback (names only for admins)
 */

// Table auto-create
add_action('init', function () {
  global $wpdb;
  $table = $wpdb->prefix . 'sl_feedback';
  if ($wpdb->get_var($wpdb->prepare("SHOW TABLES LIKE %s", $table)) !== $table) {
    $charset = $wpdb->get_charset_collate();
    $wpdb->query("CREATE TABLE {$table} (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      email VARCHAR(200) NOT NULL,
      answers_json LONGTEXT NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      user_agent VARCHAR(400) DEFAULT NULL,
      UNIQUE KEY uq_email (email)
    ) {$charset}");
  }
});

// Routes
add_action('rest_api_init', function () {

  register_rest_route('silverline/v1', '/feedback', [
    'methods'  => 'POST',
    'callback' => 'sl_feedback_post',
    'permission_callback' => '__return_true',
  ]);

  register_rest_route('silverline/v1', '/feedback', [
    'methods'  => 'GET',
    'callback' => 'sl_feedback_get',
    'permission_callback' => '__return_true',
  ]);

  register_rest_route('silverline/v1', '/feedback/(?P<id>\d+)', [
    'methods'  => 'DELETE',
    'callback' => 'sl_feedback_delete',
    'permission_callback' => function () {
      return current_user_can('manage_options');
    },
  ]);
});

// POST – submit or update feedback
function sl_feedback_post(WP_REST_Request $req) {
  global $wpdb;
  $table = $wpdb->prefix . 'sl_feedback';

  $body = json_decode($req->get_body(), true);
  if (!is_array($body)) {
    return new WP_REST_Response(['ok' => false, 'error' => 'invalid_body'], 400);
  }

  $name    = isset($body['name'])    ? sanitize_text_field(trim($body['name']))    : '';
  $email   = isset($body['email'])   ? sanitize_email(trim($body['email']))        : '';
  $answers = isset($body['answers']) ? $body['answers']                            : null;

  if ($name === '' || $email === '' || !is_array($answers)) {
    return new WP_REST_Response(['ok' => false, 'error' => 'missing_fields', 'message' => 'name, email und answers sind Pflicht'], 400);
  }

  $answers_json = wp_json_encode($answers, JSON_UNESCAPED_UNICODE);
  $ua = isset($_SERVER['HTTP_USER_AGENT']) ? substr(sanitize_text_field($_SERVER['HTTP_USER_AGENT']), 0, 400) : null;

  $existing = $wpdb->get_var($wpdb->prepare("SELECT id FROM {$table} WHERE email = %s LIMIT 1", $email));

  if ($existing) {
    $wpdb->update(
      $table,
      ['name' => $name, 'answers_json' => $answers_json, 'user_agent' => $ua],
      ['id' => $existing],
      ['%s', '%s', '%s'],
      ['%d']
    );
  } else {
    $wpdb->insert(
      $table,
      ['name' => $name, 'email' => $email, 'answers_json' => $answers_json, 'user_agent' => $ua],
      ['%s', '%s', '%s', '%s']
    );
  }

  return new WP_REST_Response(['ok' => true], 200);
}

// GET – list all feedback
function sl_feedback_get(WP_REST_Request $req) {
  global $wpdb;
  $table = $wpdb->prefix . 'sl_feedback';

  if ($wpdb->get_var($wpdb->prepare("SHOW TABLES LIKE %s", $table)) !== $table) {
    return new WP_REST_Response(['ok' => true, 'responses' => []], 200);
  }

  $is_admin = current_user_can('manage_options');

  $rows = $wpdb->get_results("SELECT * FROM {$table} ORDER BY created_at DESC", ARRAY_A);
  $out = [];
  foreach ($rows as $row) {
    $entry = [
      'id'         => (int) $row['id'],
      'answers'    => json_decode($row['answers_json'], true),
      'created_at' => $row['created_at'],
    ];
    if ($is_admin) {
      $entry['name']  = $row['name'];
      $entry['email'] = $row['email'];
    }
    $out[] = $entry;
  }

  return new WP_REST_Response(['ok' => true, 'responses' => $out, 'is_admin' => $is_admin], 200);
}

// DELETE – remove a single feedback entry (admin only)
function sl_feedback_delete(WP_REST_Request $req) {
  global $wpdb;
  $table = $wpdb->prefix . 'sl_feedback';
  $id = (int) $req['id'];

  $deleted = $wpdb->delete($table, ['id' => $id], ['%d']);
  if ($deleted) {
    return new WP_REST_Response(['ok' => true], 200);
  }
  return new WP_REST_Response(['ok' => false, 'error' => 'not_found'], 404);
}

// Shortcode [sl_feedback_js] – outputs the feedback JS, bypassing KSES
add_shortcode('sl_feedback_js', function () {
  ob_start();
  ?>
<script>
(function(){
  var API='/wp-json/silverline/v1/feedback';
  var NONCE='<?php echo wp_create_nonce("wp_rest"); ?>';
  var QS=[
    {id:'q1',l:'Wie oft nutzt du Silverline?',t:'c'},
    {id:'q2',l:'Was gef\u00e4llt dir am besten?',t:'t'},
    {id:'q3',l:'Was fehlt dir am meisten?',t:'t'},
    {id:'q4',l:'Bereit zu bezahlen?',t:'c'},
    {id:'q5',l:'Bedingungen f\u00fcr Zahlung',t:'t'},
    {id:'q6',l:'Fairer Betrag/Monat',t:'c'},
    {id:'q7',l:'Intuitivit\u00e4t (1-5)',t:'s'},
    {id:'q8',l:'Weiterempfehlung (0-10)',t:'n'},
    {id:'q9',l:'Wunsch-Feature',t:'t'},
    {id:'q10',l:'Sonstiges',t:'t'}
  ];
  function gid(id){return document.getElementById(id);}
  function radio(name){var el=document.querySelector('input[name="'+name+'"]:checked');return el?el.value:'';}
  function txt(id){var el=gid(id);return el?(el.value||'').trim():'';}
  function esc(s){var d=document.createElement('div');d.textContent=s;return d.innerHTML;}
  function qsa(sel,ctx){return (ctx||document).querySelectorAll(sel);}
  function rankUpdateBadges(){
    var items=qsa('#sl-q9-rank .sl-rank-item');
    for(var i=0;i<items.length;i++){
      var b=items[i].querySelector('.sl-rank-badge');
      if(b)b.textContent=String(i+1);
    }
  }
  function rankInit(){
    var list=gid('sl-q9-rank');if(!list)return;
    var dragging=null;
    function moveItem(li,dir){
      if(!li)return;
      if(dir<0&&li.previousElementSibling){list.insertBefore(li,li.previousElementSibling);}
      if(dir>0&&li.nextElementSibling){list.insertBefore(li.nextElementSibling,li);}
      rankUpdateBadges();
    }
    var items=qsa('.sl-rank-item',list);
    for(var j=0;j<items.length;j++){
      var li0=items[j];
      // Fallback controls for mobile/non-drag browsers
      if(!li0.querySelector('[data-move]')){
        var controls=document.createElement('span');
        controls.style.display='inline-flex';
        controls.style.gap='4px';
        controls.style.marginLeft='8px';
        controls.innerHTML=
          '<button type="button" data-move="up" style="border:1px solid #334155;background:#1e293b;color:#cbd5e1;border-radius:6px;padding:0 6px;font-size:12px;line-height:20px;cursor:pointer;">↑</button>'+
          '<button type="button" data-move="down" style="border:1px solid #334155;background:#1e293b;color:#cbd5e1;border-radius:6px;padding:0 6px;font-size:12px;line-height:20px;cursor:pointer;">↓</button>';
        li0.appendChild(controls);
      }
    }
    list.addEventListener('click',function(e){
      var btn=e.target.closest('[data-move]');if(!btn)return;
      e.preventDefault();
      var li=btn.closest('.sl-rank-item');if(!li)return;
      moveItem(li,btn.getAttribute('data-move')==='up'?-1:1);
    });
    list.addEventListener('dragstart',function(e){
      var li=e.target.closest('.sl-rank-item');if(!li)return;
      dragging=li;li.classList.add('dragging');
      if(e.dataTransfer){
        e.dataTransfer.effectAllowed='move';
        try{e.dataTransfer.setData('text/plain',li.getAttribute('data-feature')||'item');}catch(_){}
      }
    });
    list.addEventListener('dragend',function(){
      if(dragging)dragging.classList.remove('dragging');
      dragging=null;rankUpdateBadges();
    });
    list.addEventListener('dragover',function(e){
      if(!dragging)return;
      e.preventDefault();
      var after=null;
      var nodes=qsa('.sl-rank-item',list);
      for(var i=0;i<nodes.length;i++){
        var it=nodes[i];
        if(it===dragging)continue;
        var r=it.getBoundingClientRect();
        if(e.clientY<r.top+r.height/2){after=it;break;}
      }
      if(after)list.insertBefore(dragging,after);else list.appendChild(dragging);
    });
    rankUpdateBadges();
  }
  function readRankOrder(){
    var items=qsa('#sl-q9-rank .sl-rank-item'),out=[];
    for(var i=0;i<items.length;i++){
      out.push(items[i].getAttribute('data-feature')||items[i].textContent.trim());
    }
    return out;
  }
  function readOwnIdeas(){
    var out=[];
    for(var i=1;i<=3;i++){
      var idea=txt('sl-q9-own-'+i),prio=txt('sl-q9-own-'+i+'-prio');
      if(!idea)continue;
      out.push({idea:idea,priority:prio||''});
    }
    return out;
  }
  function buildQ9Summary(){
    var rank=readRankOrder(),own=readOwnIdeas(),parts=[],i;
    if(rank.length){parts.push('Ranking: '+rank.map(function(x,idx){return (idx+1)+'. '+x;}).join(' | '));}
    if(own.length){
      var ownTxt=[];
      for(i=0;i<own.length;i++){ownTxt.push((own[i].priority?own[i].priority+': ':'')+own[i].idea);}
      parts.push('Eigene Vorschläge: '+ownTxt.join(' | '));
    }
    return parts.join(' || ');
  }
  function toast(msg,err){
    var el=gid('sl-toast');if(!el)return;
    el.textContent=msg;
    el.className='sl-toast visible'+(err?' error':'');
    setTimeout(function(){el.className='sl-toast';},3500);
  }

  /* Range slider value display */
  var rng=gid('sl-q8-range'),rngVal=gid('sl-q8-val');
  if(rng&&rngVal){rng.addEventListener('input',function(){rngVal.textContent=this.value;});}

  function getAnswers(){
    var q8v=gid('sl-q8-range');
    return {
      q1:radio('q1'),
      q2:txt('sl-q2'),
      q3:txt('sl-q3'),
      q4:radio('q4'),
      q5:txt('sl-q5'),
      q6:radio('q6'),
      q7:radio('q7'),
      q8:q8v?q8v.value:'',
      q9:buildQ9Summary(),
      q9_rank:readRankOrder(),
      q9_own:readOwnIdeas(),
      q10:txt('sl-q10')
    };
  }

  function slSubmit(){
    var name=txt('sl-name'),email=txt('sl-email');
    if(!name||!email){toast('Bitte Name und E-Mail ausf\u00fcllen.',true);return;}
    if(email.indexOf('@')<1){toast('Bitte eine g\u00fcltige E-Mail eingeben.',true);return;}
    var btn=gid('sl-submit');
    if(btn){btn.style.opacity='0.5';btn.textContent='Wird gesendet...';}
    fetch(API,{method:'POST',headers:{'Content-Type':'application/json','X-WP-Nonce':NONCE},credentials:'same-origin',body:JSON.stringify({name:name,email:email,answers:getAnswers()})}).then(function(r){return r.json();}).then(function(d){
      if(btn){btn.style.opacity='1';btn.textContent='Feedback absenden';}
      if(d.ok){
        var fw=gid('sl-form-wrap'),ty=gid('sl-thank-you');
        if(fw)fw.style.display='none';if(ty)ty.style.display='block';
        toast('Feedback gespeichert!');loadR();
      } else {toast(d.message||d.error||'Fehler beim Speichern.',true);}
    }).catch(function(){if(btn){btn.style.opacity='1';btn.textContent='Feedback absenden';}toast('Netzwerkfehler.',true);});
  }

  var sb=gid('sl-submit');
  if(sb)sb.addEventListener('click',function(e){e.preventDefault();slSubmit();});

  /* "Feedback anpassen" button */
  var editBtn=gid('sl-edit-btn');
  if(editBtn)editBtn.addEventListener('click',function(e){
    e.preventDefault();
    var fw=gid('sl-form-wrap'),ty=gid('sl-thank-you');
    if(fw)fw.style.display='';if(ty)ty.style.display='none';
    window.scrollTo({top:0,behavior:'smooth'});
  });

  function loadR(){
    fetch(API,{credentials:'same-origin',headers:{'X-WP-Nonce':NONCE}}).then(function(r){return r.json();}).then(function(d){
      var le=gid('sl-loading');if(le)le.style.display='none';
      if(!d.ok||!d.responses||d.responses.length===0){
        var re=gid('sl-responses');if(re)re.innerHTML='<p style="color:#64748b;text-align:center;font-size:0.9em;">Noch keine Antworten.</p>';return;
      }
      var te=gid('sl-responses-title'),se=gid('sl-stats');
      if(te)te.style.display='';if(se)se.style.display='';
      rStats(d.responses,d.is_admin);rResp(d.responses,d.is_admin);
    }).catch(function(){var le=gid('sl-loading');if(le)le.innerHTML='<p style="color:#64748b;">Laden fehlgeschlagen.</p>';});
  }

  /* inline style helpers */
  var S={
    card:'padding:14px 18px;border:1px solid #334155;border-radius:10px;background:#0f172a;margin-bottom:16px;',
    bar:'display:flex;align-items:center;gap:8px;margin:4px 0;font-size:0.85em;',
    lbl:'min-width:140px;color:#94a3b8;white-space:nowrap;',
    trk:'flex:1;height:8px;background:#1e293b;border-radius:4px;overflow:hidden;',
    fill:'height:100%;border-radius:4px;background:linear-gradient(90deg,#2563eb,#3b82f6);',
    pct:'min-width:40px;text-align:right;color:#94a3b8;font-size:0.85em;',
    resp:'padding:14px 16px;border:1px solid #1e293b;border-radius:10px;background:#0c1929;margin-bottom:10px;',
    meta:'font-size:0.78em;color:#64748b;margin-bottom:8px;',
    ql:'font-size:0.78em;color:#64748b;margin:8px 0 2px;',
    al:'font-size:0.88em;color:#c8d0dc;padding:2px 0;'
  };

  function rStats(rs,adm){
    var w=gid('sl-stats');if(!w)return;
    var n=rs.length;
    var h='<div style="'+S.card+'">';
    h+='<div style="font-size:1em;color:#e2e8f0;font-weight:600;margin-bottom:12px;">\uD83D\uDCCA '+n+' Teilnehmer</div>';
    h+=sBar('Zahlungsbereitschaft',rs,'q4',['Ja','Vielleicht','Eher nein','Nein']);
    h+=sBar('Nutzungsh\u00e4ufigkeit',rs,'q1',['T\u00e4glich','W\u00f6chentlich','Monatlich','Selten','Gerade erst entdeckt']);
    h+=sBar('Fairer Betrag',rs,'q6',['0\u20133 CHF','3\u20135 CHF','5\u201310 CHF','10+ CHF','Einmalzahlung']);
    var ss=0,sc=0,ns=0,nc=0,i;
    for(i=0;i<n;i++){var v=rs[i].answers&&rs[i].answers.q7;if(v&&parseInt(v)>0){ss+=parseInt(v);sc++;}}
    if(sc>0)h+='<div style="margin-top:12px;font-size:0.9em;color:#94a3b8;">\u2B50 Intuitivit\u00e4t: <b style="color:#f59e0b;">'+(ss/sc).toFixed(1)+' / 5</b> <span style="color:#64748b;">('+sc+')</span></div>';
    for(i=0;i<n;i++){var v2=rs[i].answers&&rs[i].answers.q8;if(v2!==''&&v2!==null&&v2!==undefined&&parseInt(v2)>=0){ns+=parseInt(v2);nc++;}}
    if(nc>0){var na=(ns/nc).toFixed(1),cl=na>=8?'#4ade80':na>=6?'#fbbf24':'#f87171';h+='<div style="margin-top:6px;font-size:0.9em;color:#94a3b8;">\uD83D\uDC4D Weiterempfehlung: <b style="color:'+cl+';">'+na+' / 10</b> <span style="color:#64748b;">('+nc+')</span></div>';}
    h+='</div>';w.innerHTML=h;
  }

  function sBar(title,rs,key,opts){
    var c={},i,tot=0;
    for(i=0;i<opts.length;i++)c[opts[i]]=0;
    for(i=0;i<rs.length;i++){var v=rs[i].answers&&rs[i].answers[key];if(v&&c.hasOwnProperty(v)){c[v]++;tot++;}}
    if(tot===0)return '';
    var h='<div style="margin-top:12px;font-size:0.82em;color:#64748b;margin-bottom:6px;font-weight:600;">'+title+'</div>';
    for(i=0;i<opts.length;i++){
      var p=Math.round(c[opts[i]]/tot*100);
      h+='<div style="'+S.bar+'">';
      h+='<span style="'+S.lbl+'">'+opts[i]+'</span>';
      h+='<span style="'+S.trk+'"><span style="'+S.fill+'width:'+p+'%;"></span></span>';
      h+='<span style="'+S.pct+'">'+p+'%</span>';
      h+='</div>';
    }
    return h;
  }

  function delFb(id){
    if(!confirm('Feedback #'+id+' wirklich l\u00f6schen?'))return;
    fetch(API+'/'+id,{method:'DELETE',credentials:'same-origin',headers:{'X-WP-Nonce':NONCE}}).then(function(r){return r.json();}).then(function(d){
      if(d.ok){toast('Gel\u00f6scht.');loadR();}
      else{toast(d.error||'Fehler beim L\u00f6schen.',true);}
    }).catch(function(){toast('Netzwerkfehler.',true);});
  }
  window._slDel=delFb;

  function rResp(rs,adm){
    var w=gid('sl-responses');if(!w)return;
    var h='',i,q;
    for(i=0;i<rs.length;i++){
      var r=rs[i],a=r.answers||{},dt=r.created_at?r.created_at.substring(0,10):'';
      h+='<div style="'+S.resp+'" id="sl-fb-'+r.id+'">';
      h+='<div style="display:flex;justify-content:space-between;align-items:center;'+S.meta+'">';
      h+='<div>';
      if(adm&&r.name){h+='<b style="color:#e2e8f0;">'+esc(r.name)+'</b>';if(r.email)h+=' \u00b7 <span style="color:#64748b;">'+esc(r.email)+'</span>';h+=' \u00b7 ';}
      h+=dt+'</div>';
      if(adm)h+='<span style="cursor:pointer;color:#64748b;font-size:0.85em;padding:2px 8px;border:1px solid #334155;border-radius:6px;" data-del="'+r.id+'">\uD83D\uDDD1</span>';
      h+='</div>';
      for(q=0;q<QS.length;q++){
        var qd=QS[q],val=a[qd.id];
        if(val===''||val===null||val===undefined)continue;
        if(qd.id==='q9'){
          var rank=Array.isArray(a.q9_rank)?a.q9_rank:[];
          var own=Array.isArray(a.q9_own)?a.q9_own:[];
          h+='<div style="'+S.ql+'">Feature-Priorisierung</div>';
          if(rank.length){
            h+='<div style="'+S.al+'">';
            for(var ri=0;ri<rank.length;ri++){
              h+='<div>'+(ri+1)+'. '+esc(String(rank[ri]))+'</div>';
            }
            h+='</div>';
          } else {
            h+='<div style="'+S.al+'">'+esc(String(val))+'</div>';
          }
          if(own.length){
            h+='<div style="'+S.ql+'">Eigene Vorschläge</div>';
            h+='<div style="'+S.al+'">';
            for(var oi=0;oi<own.length;oi++){
              var pr=own[oi]&&own[oi].priority?String(own[oi].priority):'';
              var iv=own[oi]&&own[oi].idea?String(own[oi].idea):'';
              if(!iv)continue;
              h+='<div>'+(pr?esc(pr)+': ':'')+esc(iv)+'</div>';
            }
            h+='</div>';
          }
          continue;
        }
        if(qd.t==='s')val=val+' / 5 \u2605';
        else if(qd.t==='n')val=val+' / 10';
        else val=esc(String(val));
        h+='<div style="'+S.ql+'">'+qd.l+'</div>';
        h+='<div style="'+S.al+'">'+val+'</div>';
      }
      h+='</div>';
    }
    w.innerHTML=h;
    /* bind delete buttons */
    var dels=w.querySelectorAll('[data-del]');
    for(var d=0;d<dels.length;d++){
      dels[d].addEventListener('click',function(){delFb(parseInt(this.getAttribute('data-del')));});
    }
  }

  loadR();
  rankInit();
})();
</script>
  <?php
  return ob_get_clean();
});
