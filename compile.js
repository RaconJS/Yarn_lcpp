function loga(...a){console.log(...a);}
function logData(...a){console.log(...a.map(v=>v.toLog?.()??v))}//log data emmits surtain information
function compile(text,throwError){
	throwError ??= (msg = "", errorFunction = a => Error(a)) => {throw errorFunction(msg)};
	const regex = /(λ|\\|>)|\b\w+\b|[+\-*&|^!:]{2}|"(?:[^"]|\\")*"|'(?:[^']|\\')*'|\/\*[\s\S]*\*\/|\/\/.*|\S|\s+/g;
	//classes
		class File{//used for error data
			constructor(name){
				this.name = name;
			}
			words;//:WordSymbol[]
			lines;//:#	
		};
		class WordSymbol extends String{
			constructor(data={}){super(data.word);Object.assign(this,data);}
			word;//:string
			type;//:"" | "whiteSpace" | "comment" | "bracket" | "function" | "assignment" | "label" | "number" | "string" | "operator"
			subtype;//:"" | when (type == "bracket") : "open" | "close" | when (type == "function") : "unnamedParameter" | "namedParameter"
			
			//error data
			line;//:Number ; counts from 1
			column;//:Number ; counts from 1
			file;//:File
			//used with type == "bracket" && subtype == "open"
				contence;//:Tree(WordSymbol)
				endBracket;//:WordSymbol
			throwError(errorType,errorMessage,errorFunc,stack=undefined){
				throwError(
					"lc++ ERROR:\n"
					+"l:"+this.line+" c:"+this.column+"\n"
					// " ".repeat(lineLen)+" |\n"
					+this.display_markWordInLine(errorType+" error")+"\n"
					+"error"+": "+errorMessage+"\n"
				,errorFunc);
			}
			display_markWordInLine(lineRaw){
				let line = this.file.lines[this.line-1].replace(/^\s*/,"");
				return line+"\n"+line.substr(0,this.column-1).replaceAll(/./g," ")+"^".repeat(this.word.length);
			}
		}
	//----
	const file = new File("");
	const words = ((text,regex,file)=>{
		let words = [];
		let column = 1, line = 1;
		([...text.matchAll(regex)]??[]).forEach(v=>{
			let word = v[0];
			let wordSymbol = new WordSymbol({
				word,
				column,line,file,
				match:v,
				type:
					word.match(/\s+/)?"whiteSpace":
					word.match(/^\/[/*]/)?"comment":
					word.match(/^[()\[\]{}]$/)?"bracket":
					word.match(/^([λ\\]|>)$/)?"function":
					word.match(/^(=)$/)?"assignment":
					word.match(/^[+\-*^&~|]{1,2}|[/!%]$/)?"operator":
					word.match(/^(::|,)$/)?"symbol"://misc syntax symbols
					word.match(/\b\w+\b/)?"simple":
					""
				,
				subtype:
					word.match(/^[λ\\]$/)?"unnamedParameter":
					word.match(/^>$/)?"namedParameter":
					word.match(/^[(\[{]$/)?"open":
					word.match(/^[)\]}]$/)?"close":
					word.match(/\b[0-9]+\b/)?"number":
					word.match(/\b\w+\b/)?"label":
					""
				,
			});
			if(word.match("\n")){
				column = word.match(/(?<=\n)\N*$/)[0].length+1;
				line+=[...word.matchAll("\n")].length;
			}else column+=word.length;
			words.push(wordSymbol);
		});
		file.words = words;
		return words;
	})(text,regex,file);
	const syntaxTree = ((words)=>{//()->syntaxTree:{word:String,type:string,subtype:string}[]
		let treePartList = [[]];
		let bracketLevel = 0;
		file.lines = text.split("\n");
		let syntaxTree = words.forEach(wordSymbol=>{
			if("\"'`".includes(wordSymbol+""))wordSymbol.throwError("syntax","missing closing quote in string",a=>Error(a));
			if(wordSymbol.type == "comment" || wordSymbol.type == "whiteSpace")return;
			if(wordSymbol.type == "bracket"){
				if(wordSymbol.subtype == "open"){
					treePartList[treePartList.length-1].push(wordSymbol);
					treePartList.push([]);
				}
				if(wordSymbol.subtype == "close"){
					let lastTree = treePartList[treePartList.length-2];
					if({"{":"}","[":"]","(":")"}[lastTree[lastTree.length-1]] != wordSymbol.word)lastTree[lastTree.length-1].throwError("syntax","unmatching brackets '"+lastTree[lastTree.length-1].word+"' '"+wordSymbol.word+"'",a=>Error(a));
					if(treePartList.length == 1)wordSymbol.throwError("syntax","too many closing brackets",a=>Error(a));
					lastTree[lastTree.length-1].contence = treePartList.pop();
					lastTree[lastTree.length-1].endBracket = wordSymbol;
				}
			}
			else treePartList[treePartList.length-1].push(wordSymbol);
		});
		let tree;//temporty variable
		if(treePartList.length>1)(tree=treePartList[0])[tree.length-1].throwError("syntax","unclosed bracket",a=>Error(a));
		return treePartList[0];
	})(words);
	const {patterns,rootPattern} = ((syntaxTree)=>{//:Pattern
		//classes
			class Pattern{
				constructor(data={}){
					Object.assign(this,data);
					if(this.type != "file" && !this.parent)throw Error ("compiler error")
				}
				//used to recognise the type of pattern
					parent;//:Pattern?. (only exception is for the root pattern when `type == "file"` and `parent == undefined`)
					wordSymbols;//:WordSymbol[]
					//pattern;//:string e.g. 
					type;//:"file" | "assignment" | "function" | "argument" | "simple" | "operator" | "block" | "array" | "object" | "indexer";
					subtype;//: 
						//when type == "simple" : "number" | "string" | "label"
						//when type == "assignment" : single | "with" | "array" | "tuple"
						//when type == "function"   : single | "using" | "array" | "tuple"
						//when type == "operator"
				list;//:Pattern[]? ; e.g. a = f x, -> `list = [f,x]`
				forEach(foo){
					if(this.list){this.list.forEach(foo)}
				}
			}
			class OperatorPattern extends Pattern{
				constructor(data={}){super(data);Object.assign(this,data);}
				type = "operator";
				static operator;
				static operators = []
			}
			class BracketPattern extends Pattern{
				constructor(data={}){super(data);Object.assign(this,data);}
				type;//:"block" | "array" | "object"
				assignmentParent;//:AssignmentPattern
			}
			class IndexerPattern extends Pattern{
				constructor(data={}){super(data);Object.assign(this,data);}
				//'arg1 :: arg2' 'length :: index' e.g. '{1 2 3}3::1'
				arg1;//:(Pattern|TypeAnnotation)?
				arg2;//:Pattern
			}
			class ParamsPattern extends Pattern{//'>' '='
				constructor(data={}){super(data);Object.assign(this,data);}
				//matches: '=' in 'a =' or '>' in 'a >'
				list;//:Pattern[]
				params;//:Param[]
				assignmentParent;//:AssignmentPattern
			}
			class AssignmentPattern extends ParamsPattern{
				assignmentParent = this;
			}//'='
			class Param{//'a>'
				constructor(data={}){Object.assign(this,data);}
				parent;//:Pattern
				name;//:wordSymbol
				
				blockScope;//:BracketPattern
				typeAnnotation = TypeAnnotation.lambda;//:TypeAnnotation
			}
			class ArgumentPattern extends Pattern{
				constructor(data={}){super(data);Object.assign(this,data);}
				type = "argument";
				subtype = "label";
				argument;//:Argument
			}
			class Argument{//'a'
				constructor(data={}){Object.assign(this,data);}
				typeAnnotation;//:TypeAnnotation?
				name;//:WordSymbol				
				assignmentParent;//:AssignmentPattern
				param;//:Param ; is assigned after Argument instance it is created
			}
			class TypeAnnotation{
				constructor(data={}){Object.assign(this,data);}
				properties = new Map();//: Map(string => pattern)
				static lambda = new this;
				static Reference = class extends this{
					argument;//:Argument
				}
			}
		//----
		//MatchFunction<T> = (syntaxTree,index,parentPattern)=>{T?,index} ; if no match found then `index` should stay the same as the input `index`
			//':'
			function match_typeAnnotation(syntaxTree,index,parentPattern,assignmentParent){//:{typeAnnotation?,index} ; ':Type'
				let typeAnnotation = TypeAnnotation.lambda;
				let output = ()=>({typeAnnotation,index});
				let oldIndex = index;
				if(syntaxTree[index]?.word == ":"){
					index++;
					let wordSymbol = syntaxTree[index];
					if(wordSymbol){
						if(wordSymbol.type == "function" && wordSymbol.subtype == "unnamedParameter"){// 'a:λ' similar to the 'any' type from typescript
							typeAnnotation = TypeAnnotation.lambda;
						}
						else if(wordSymbol.type == "simple" && wordSymbol.subtype == "label"){
							typeAnnotation = new TypeAnnotation.Reference({argument:new Argument({
								name:wordSymbol,
								assignmentParent
							})});
						}
					}
				}
				return {index:oldIndex};
			}
			//'a' or 'a:T' in '{a:T b:T1} >'
			function match_parameter(syntaxTree,index,parentPattern,assignmentParent){//:{param?,index} ; e.g. '[a b]=' or 'a>'
				//assume: param.parent is assinged by the caller of this function
				let a=syntaxTree, i=index;
				let oldIndex=index;
				let param = [];
				let output = ()=>({param,index});
				if(a[i]?.type == "simple" && a[i]?.subtype == "label"){//'a:b' or 'a:2'
					let typeAnnotation;
					index++;
					param = new Param({
						name:a[i],
						assignmentParent,
						typeAnnotation:({index,typeAnnotation}=match_typeAnnotation(syntaxTree,index,parentPattern,assignmentParent)).typeAnnotation,
					});
					return output();
				}
				return {index:oldIndex};
			}
			function match_simple(syntaxTree,index,parentPattern,assignmentParent){
				let a=syntaxTree, i=index;
				let oldIndex=index;
				let pattern;
				let output = ()=>({pattern,index});
				if(a[i]?.type == "simple"){//'a:b' or 'a:2'
					let wordSymbol = a[i];
					let typeAnnotation;
					index++;
					({index,typeAnnotation}=match_typeAnnotation(syntaxTree,index)).typeAnnotation;
					typeAnnotation??=undefined;
					if(a[i]?.subtype == "label"){
						pattern = new ArgumentPattern({
							wordSymbols:[wordSymbol],
							parent:parentPattern,
							assignmentParent,
							argument:new Argument({
								//if undefined it will be assigned later
								name:wordSymbol,
								typeAnnotation,
								assignmentParent
							}),
						});
					}
					else if(a[i]?.subtype == "number"){
						pattern = new Pattern({
							wordSymbols:[a[i]],
							type:"simple",
							subtype:"number",
							parent:parentPattern,
							assignmentParent,

						});
					}
					return output();
				}
				return {index:oldIndex};
			}
			function match_operator(syntaxTree,index,parentPattern,assignmentParent){
				let a=syntaxTree, i=index;
				let oldIndex=index;
				let pattern = [];
				let output = ()=>({pattern,index});
				if(a[i]?.type == "operator"){//'a:b' or 'a:2'
					index++;
					pattern = new OperatorPattern({
						wordSymbols:[a[i]],
						keywords:[a[i]],
						parent:parentPattern,
						assignmentParent,
					});
					return output();
				}
				return {index:oldIndex};
			}
			// '{a b}' in '{a b}>'
			function match_parameters(syntaxTree,index,parentPattern,assignmentParent,isMatchManditory = false){//:{params:Param[]?,index} ; e.g. '[a b]=' or 'a>'
				//assume: param.parent is assinged by the caller of this function
				let a=syntaxTree, i=index;
				let oldIndex = index;
				let params = [];
				let output = ()=>({params,index});
				let param;
				if(({index,param}=match_parameter(syntaxTree,index,parentPattern,assignmentParent)).param){
					params.push(param);
					return output();
				}
				matchBlock:if(a[i]?.type == "bracket"){
					let oldIndex = 0;
					let syntaxTree = a[i].contence;
					let isAllowedComma = false;//prevents empty parameters e.g. stops (a,,b,c) and '(,a,b,c)'
					for(let index = 0;index<syntaxTree.length;){
						let oldI1 = index;
						if(({index,param}=match_parameter(syntaxTree,index,parentPattern,assignmentParent,)).param){
							params.push(param);
							isAllowedComma = true;
							continue;
						}
						if(isAllowedComma && syntaxTree[index].word == ","){
							//note: '!isAllowedComma' is handled by the else if bellow
							index++;
							isAllowedComma = false;
							continue;
						}
						else if(isMatchManditory){
							syntaxTree[oldIndex].throwError("syntax", "expected parameter got '"+syntaxTree[oldIndex]+"'", a=>Error(a));
						}
						else break matchBlock;
						if(index <= oldI1)throw Error("compiler error");
					}
					return output();
				}
				return {index:oldIndex};
			}
			function match_assignmentOrFunction(syntaxTree,index,parentPattern,assignmentParent){
				let output = ()=>({index,pattern});
				let pattern;
				let params;
				let oldIndex = index;
				if(!syntaxTree[index])return {index:oldIndex};
				if(syntaxTree[index]?.subtype!="unnamedParameter")
					({params,index} = match_parameters(syntaxTree,index,parentPattern,assignmentParent));
				if(params && (syntaxTree[index]?.type == "function" || syntaxTree[index]?.type == "assignment")){
					//e.g. [a b]= , {a b}>
					let parameterWordSymbol = syntaxTree[index-1];
					let type = syntaxTree[index].type == "assignment"? "assignment": "function";
					pattern = new ParamsPattern({
						type,
						subtype:{
							"function": {"(": "using", "[": "array", "{": "tuple",},
							"assignment": {"(": "with", "[": "array", "{": "tuple",},
						}[type][parameterWordSymbol]??"single",
						assignmentParent,
						parent:parentPattern,
						wordSymbols:[syntaxTree[index-1],syntaxTree[index]],
						params,
						list:[],
					});
					if(pattern.type == "assignment"){
						pattern = new AssignmentPattern(pattern);
						//assume: pattern.assignmentParent == pattern
						for(let param of pattern.params){
							param.blockScope = pattern.parent.parent;//assume: pattern.parent:CommaCodeBlockPattern && pattern.parent.parent is the block scope
						}
					}

					index++;
					({index}=singleCommaCodeBlock(syntaxTree,index,pattern,assignmentParent));
					return output();
				}
				return {index:oldIndex};
			}
			function match_indexerPattern(syntaxTree,index,parentPattern,assignmentParent){//:{pattern}
				//matches 'a::b' or 'a'
				//includes match_singlePattern
				let pattern, arg1, arg2;
				let wordSymbol;
				let oldIndex = index;
				let output = ()=>({index,pattern});
				let newParentPattern = new IndexerPattern({parent:parentPattern});
				({pattern:arg1,index}=match_simple(syntaxTree,index,newParentPattern,assignmentParent));
				if((wordSymbol=syntaxTree[index])?.word == "::") index++;
				else return {pattern:arg1,index};
				({pattern:arg2,index}=match_complexPattern(syntaxTree,index,newParentPattern,assignmentParent));
				if(!arg2){
					syntaxTree[oldIndex].throwError("syntax", "expected expression got '"+syntaxTree[oldIndex]+"'", a=>Error(a));
					return {index:oldIndex};
				}
				pattern = Object.assign(newParentPattern,new IndexerPattern({parent:parentPattern,assignmentParent,wordSymbols:[wordSymbol],type:"indexer",arg1,arg2}));
				return output();
			}
			function match_singlePattern(syntaxTree,index,parentPattern,assignmentParent){//:{pattern?,index}
				let wordSymbol = syntaxTree[index];
				let pattern;
				let output = ()=>({index,pattern});
				let oldIndex = index;
				let params;
				if(({pattern,index}=match_bracket(syntaxTree,index,parentPattern,assignmentParent)).pattern)return output();
				if(({pattern,index}=match_simple(syntaxTree,index,parentPattern,assignmentParent)).pattern)return output();
				return {index:oldIndex};
			}
			function match_complexPattern(syntaxTree,index,parentPattern,assignmentParent){//:{pattern?,index}; //includes '(a = 2)::b' and ''
				let wordSymbol = syntaxTree[index];
				let pattern;
				let output = ()=>({index,pattern});
				let oldIndex = index;
				let params;
				if(({pattern,index}=match_assignmentOrFunction(syntaxTree,index,parentPattern,assignmentParent)).pattern)return output();
				if(({pattern,index}=match_indexerPattern(syntaxTree,index,parentPattern,assignmentParent)).pattern)return output();
				if(({pattern,index}=match_bracket(syntaxTree,index,parentPattern,assignmentParent)).pattern)return output();
				if(({pattern,index}=match_simple(syntaxTree,index,parentPattern,assignmentParent)).pattern)return output();
				if(({pattern,index}=match_operator(syntaxTree,index,parentPattern,assignmentParent)).pattern)return output();

				return {index:oldIndex};
			}
			function match_bracket(syntaxTree,index,parentPattern,assignmentParent) {//:{pattern?, index} ; should be checked last
				let oldIndex = index;
				let wordSymbol = syntaxTree[index];
				if(wordSymbol?.type == "bracket"){//'()'
					//assume: wordSymbol.subtype == "open"
					let pattern = new BracketPattern({
						assignmentParent,
						parent:parentPattern,
						wordSymbols:[wordSymbol],
						type:"bracket",
						subtype:{"(": "block", "[": "array", "{": "object"}[wordSymbol.word],
						list:[],
					});
					bracket(wordSymbol.contence,0,pattern,assignmentParent);
					index++;
					return {pattern,index};
				}
				return {index:oldIndex};
			}
		//----
		function singleCommaCodeBlock(syntaxTree,index,parentPattern,assignmentParent){//:{pattern, index} mutate parentPattern; 'a,'
			//matches a block that ends in a bracket or a comma. e.g. 'b c' in 'a = b c,' or '(a = b c)'
			class CommaCodeBlockPattern extends Pattern{//Does not have `wordSymbols` property
				constructor(data={}){
					super(data);Object.assign(this,data);
					delete this.wordSymbols;
				}
			}
			parentPattern = new CommaCodeBlockPattern({parent:parentPattern,assignmentParent, list:[]});
			for(;index < syntaxTree.length;){
				let oldIndex = index;
				let pattern;
				if(syntaxTree[index].word == ","){index++;break;}
				if(({pattern,index} = match_complexPattern(syntaxTree,index,parentPattern,assignmentParent))){
					parentPattern.list.push(pattern);//single pattern
					patterns.push(pattern);
				}
				if(index <= oldIndex)throw Error("compiler error");
			}
			return {index, pattern:parentPattern};
		}
		//note: assignmentParent:Pattern ; is marked by '='. used to link references together 'a= b= c, c='
		function bracket(syntaxTree,index,parentPattern,assignmentParent){//:{index} mutate assignmentParent
			for(;index<syntaxTree.length;){
				let oldIndex = index;
				let wordSymbol = syntaxTree[index];
				let pattern;
				({pattern,index} = singleCommaCodeBlock(syntaxTree,index,parentPattern,assignmentParent));
				if(index <= oldIndex)throw Error("compiler error '" + syntaxTree[oldIndex]+"'");
			}
		}
		let patterns = [];//:Pattern[]
		let rootPattern = new Pattern({type:"file", list:[], parent:undefined, assignmentParent:undefined});
		bracket(syntaxTree,0,rootPattern,rootPattern);
		return {rootPattern,patterns};
	})(syntaxTree);
	((patterns)=>{
		function convertPatternToAssignmentParent(pattern){
			pattern.labels ??= new Map();//Param[] ; contains the set of lables defined inside this code block
			pattern.labelsUsed ??= new Map();//:Param[] ; contains references to parameters e.g.'(a=1,b=2,c=3,a + b)' -> `[a,b]`
			pattern.refs ??= [];
			return pattern;
		}
		function searchParents(parent,getAns,getNext=p=>p.parent){
			if(!parent)return undefined;
			parent.isSearched = true;
			let ans = getAns(parent);
			if(!ans)ans = searchParents(getNext(parent),getAns,getNext);
			delete parent.isSearched;
			return ans
		}
		//'(a =)' adds assignments 'a =' to their `assignmentParent`s
		//gets the start labels
		for(let pattern of patterns){
			if(pattern.assignmentParent)convertPatternToAssignmentParent(pattern.assignmentParent);
			//if(!pattern.assignmentParent)throw Error("compiler error ")
			if(pattern.type == "assignment"){
				for(let param of pattern.params){
					convertPatternToAssignmentParent(param.blockScope);
					if(!param.blockScope.labels.has(param.name.word)){
						param.blockScope.labels.set(param.name.word,param);
					}
				}
			}
		}
		//links arguments to parameters
		let paramRefs = [];//:Argument[]
		for(let pattern of patterns){
			if(pattern.type == "assignment"){
				for(let param of pattern.params){
					param.blockScope.labels.set(param.name.word,param);
				}
			}
			else if(pattern.type == "argument"){//pattern.type == "simple" && pattern.type.subtype == "label"){
				let owner = searchParents(
					pattern.parent,
					parent=>parent.labels?.get?.(pattern.argument.name.word),
					parent=>parent.parent
				);//owner:Param
				if(!owner){
					pattern.wordSymbols[0].throwError("reference", "label '" + pattern.argument.name.word + "' not defined in scope", a=>Error(a));
				}
				pattern.argument.param = owner;
				pattern.argument.assignmentParent.refs.push(pattern.argument.param.parent);//pointer arg[]->param[]
				paramRefs.push(pattern.argument.assignmentParent);
			}
		}
		//check for circular references
		check:{
			//pattern.isCircular:assignmentPattern? ; is the assignment pattern that is part of a circular loop
			let assignmentParents = [];
			let loops = [];//:AssignmentPattern[] ; contains patterns for circular reference errors
			function search(assignmentParent){//returns isCircular:AssignM
				const pattern_arg = assignmentParent;
				if(pattern_arg.isCircular)
					return pattern_arg.isCircular;
				else if(pattern_arg.isCircular===false)return false;
				else if(pattern_arg.isSearched){//loop found;
					loops.push(pattern_arg);
					pattern_arg.isCircular = pattern_arg;
					return pattern_arg;
				}//return false;
				pattern_arg.isSearched = true;
				assignmentParents.push(pattern_arg);
				for(let pattern_param of pattern_arg.refs){
					
				}
				delete assignmentParent.isSearched;
			}
			for(let assignmentParent of paramRefs){
				search(assignmentParent)
			}
			for(let assignmentParent of assignmentParents){//assume
				delete assignmentParent.isCircular;
			}
		}
		//loga(patterns.map(v=>v.wordSymbols.join(" ")));
	})(patterns)
}
(async ()=>{
	let a = await new Promise((resolve,reject)=>{
		require("fs").readFile("test.lcpp","utf8",(error,data)=>{
			resolve(data);
		});
	});
	if(1)compile(a);
	else try{compile(a)}catch(e){console.log(e+"")};
})(); 