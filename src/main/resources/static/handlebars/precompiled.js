!function(){var n=Handlebars.template;(Handlebars.templates=Handlebars.templates||{}).switch_instances=n({1:function(n,l,t,e,a){var o=n.lookupProperty||function(n,l){if(Object.prototype.hasOwnProperty.call(n,l))return n[l]};return null!=(a=o(t,"if").call(null!=l?l:n.nullContext||{},null!=l?o(l,"active"):l,{name:"if",hash:{},fn:n.program(2,a,0),inverse:n.program(4,a,0),data:a,loc:{start:{line:3,column:8},end:{line:19,column:15}}}))?a:""},2:function(n,l,t,e,a){var o=null!=l?l:n.nullContext||{},u=n.hooks.helperMissing,r="function",c=n.escapeExpression,s=n.lookupProperty||function(n,l){if(Object.prototype.hasOwnProperty.call(n,l))return n[l]};return"            <li>\n                <b>"+c(typeof(n=null!=(n=s(t,"name")||(null!=l?s(l,"name"):l))?n:u)==r?n.call(o,{name:"name",hash:{},data:a,loc:{start:{line:5,column:19},end:{line:5,column:29}}}):n)+'</b>\n                <div class="btn-group btn-group-xs" role="group">\n                    <button type="button" class="btn btn-primary" onclick="Shiny.instancesModal.onDeleteInstance(\''+c(typeof(n=null!=(n=s(t,"name")||(null!=l?s(l,"name"):l))?n:u)==r?n.call(o,{name:"name",hash:{},data:a,loc:{start:{line:7,column:114},end:{line:7,column:123}}}):n)+'\');">Stop app</button>\n                    <button type="button" class="btn btn-primary" onclick="Shiny.instancesModal.onDeleteInstance(\''+c(typeof(n=null!=(n=s(t,"name")||(null!=l?s(l,"name"):l))?n:u)==r?n.call(o,{name:"name",hash:{},data:a,loc:{start:{line:8,column:114},end:{line:8,column:123}}}):n)+"');\">Restart app</button>\n                </div>\n            </li>\n"},4:function(n,l,t,e,a){var o=null!=l?l:n.nullContext||{},u=n.hooks.helperMissing,r="function",c=n.escapeExpression,s=n.lookupProperty||function(n,l){if(Object.prototype.hasOwnProperty.call(n,l))return n[l]};return'            <li>\n                <a target="_blank" href="'+c(typeof(n=null!=(n=s(t,"url")||(null!=l?s(l,"url"):l))?n:u)==r?n.call(o,{name:"url",hash:{},data:a,loc:{start:{line:13,column:41},end:{line:13,column:50}}}):n)+'">'+c(typeof(n=null!=(n=s(t,"name")||(null!=l?s(l,"name"):l))?n:u)==r?n.call(o,{name:"name",hash:{},data:a,loc:{start:{line:13,column:52},end:{line:13,column:62}}}):n)+'</a>\n                <div class="btn-group btn-group-xs" role="group">\n                    <button type="button" class="btn btn-primary" onclick="Shiny.instancesModal.onDeleteInstance(\''+c(typeof(n=null!=(n=s(t,"name")||(null!=l?s(l,"name"):l))?n:u)==r?n.call(o,{name:"name",hash:{},data:a,loc:{start:{line:15,column:114},end:{line:15,column:123}}}):n)+'\');">Stop app</button>\n                    <button type="button" class="btn btn-primary" onclick="Shiny.instancesModal.onDeleteInstance(\''+c(typeof(n=null!=(n=s(t,"name")||(null!=l?s(l,"name"):l))?n:u)==r?n.call(o,{name:"name",hash:{},data:a,loc:{start:{line:16,column:114},end:{line:16,column:123}}}):n)+"');\">Restart app</button>\n                </div>\n            </li>\n"},compiler:[8,">= 4.3.0"],main:function(n,l,t,e,a){var o=n.lookupProperty||function(n,l){if(Object.prototype.hasOwnProperty.call(n,l))return n[l]};return"<ul>\n"+(null!=(a=o(t,"each").call(null!=l?l:n.nullContext||{},null!=l?o(l,"instances"):l,{name:"each",hash:{},fn:n.program(1,a,0),inverse:n.noop,data:a,loc:{start:{line:2,column:4},end:{line:20,column:13}}}))?a:"")+"</ul>\n"},useData:!0})}();