#[allow(unused_imports)]
use regex::Regex;
#[allow(dead_code)]
mod compile {
	#![allow(non_snake_case)]
	#![allow(non_camel_case_types)]
	use std::collections::HashMap;
	#[derive(Debug)]
	pub struct GlobalCompileContext <'a>{
		pub treeNum:wordTree::Recur_type,
		pub source:HashMap<&'a str,Vec<&'a str>>,
	}
	impl GlobalCompileContext<'_>{
		pub fn new()->GlobalCompileContext<'static>{
			GlobalCompileContext{
				treeNum:0,
				source:HashMap::new(),
			}
		}
	}
	#[allow(dead_code)]
	pub mod wordTree{
		//#![allow(dead_code)]
		//#![allow(unused_variables)]
		#![allow(non_snake_case)]
		#![allow(non_camel_case_types)]
		use super::GlobalCompileContext;
		use regex::Regex;
		use std::collections::HashMap;
		pub fn throw<'a>(globalCompileContext:&GlobalCompileContext<'a>,node:Node<'a>,errorType:&str,error:&str){
			let source = &globalCompileContext.source;
			let line =source
				.get(node.pos.fileName)
				.unwrap()
				.get(node.pos.line)
				.unwrap()
			;
			println!("{:?}",
				"ERROR:".to_owned()+errorType+"\n"+error
				+line
				+(&"-".repeat(node.pos.column))+"^"
			);
			panic!("{:?}", "ERROR");
		}
		#[derive(Debug)]
		pub enum ErrorType {
			syntax,
		}
		//keep track of recursion
		#[derive(Debug)]
		pub struct Tree<'owner>{pub vec:Vec<Node<'owner>>,recur:Recur<'owner>,num:Recur_type}
		pub type Recur<'a> = HashMap<Recur_type,Recur_type>;
		pub type Recur_type = i64;
		impl Tree<'_>{
			pub fn Recur_tryCalling<'a>(from:&mut Tree<'a>,to:&Tree<'a>)->bool{
				match from.recur.get(&to.num) {
					Some(recursLeft) => {
						if *recursLeft>0 {from.recur.insert(to.num,*recursLeft-1);true}
						else {false}
					},
					None => false,
				}
			}
			pub fn Recur_trySet<'a>(from:&mut Tree<'a>,to:&Tree<'a>,newMaxRecur:Recur_type)->bool{
				match from.recur.get(&to.num) {
					Some(recursLeft) => {
						if *recursLeft>0 {from.recur.insert(to.num,*recursLeft-1);true}
						else {false}
					},
					None => {from.recur.insert(to.num,newMaxRecur);true},
				}
			}
		}
		/*impl <'owner> std::fmt::Debug for Tree<'owner> {
			fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
				f.debug_struct("")
					.field("vec",&self.0.iter().map(|v|match &v.node {
						NodeType::word(word)=>*word,
						NodeType::tree(_tree)=>"&tree",
					}).collect::<Vec<&str>>())
					//.field("n", &self.node.0)
					//.field("l", &self.charPos.line)
					//.field("c", &self.charPos.column)
					.finish()
			}
		}*/
		#[derive(Debug)]
		pub struct Node<'owner>{
			pub node:NodeType<'owner>,
			pub wordType:WordType,
			pub pos:CharPos<'owner>,//location in source code
		}
		impl Node<'_> {
			pub const NULL:Node<'static> = Node{
				node:NodeType::word(""),
				wordType:WordType::any,
				pos:CharPos{
					line:0,
					column:0,
					fileName:"",
				},
			};
			// add code here
		}
		#[derive(Debug)]
		pub enum NodeType<'owner>{
			tree(Tree<'owner>),
			word(&'owner str),
		}
		#[derive(Debug)]
		#[derive(PartialEq)]
		pub enum WordType{
			tree,// Tree
			any,//any string
			string,// ""
			number,// 123
			word,// abc
			bracket_open,// ([{
			bracket_close,// )]}
			operator,// *
		}
		#[derive(Debug)]
		#[derive(Clone)]
		pub struct CharPos<'a>{
			fileName:&'a str,
			line:usize,
			column:usize
		}
		pub fn parseFileString<'a>(s:&'a str,fileName:&'a str,globalCompileContext:&mut GlobalCompileContext<'a>)->Tree<'a>{//string->tree<string>
			let WORD_REGEX:Regex = Regex::new(
				"//[\\s\\S]*?(?:\\n|$)\
				|/\\*[\\s\\S]*?\\*/\
				|\"(?:\"|[\\s\\S]*?[^\\\\]\")\
				|'(?:'|[\\s\\S]*?[^\\\\]')\
				|`(?:`|[\\s\\S]*?[^\\\\]`)\
				|\\b0x[\\da-fA-F]+(?:\\.[\\da-fA-F]+)?\\b\
				|\\b0b[01]+(?:\\.[01]+)?\\b\
				|\\b(?:0|[1-9])[0-9]*(?:\\.[0-9]+)?\\b\
				|[\\w_]+\
				|<[=-]>|[=-]>|<[=-]\
				|::\
				|:>|<:\
				|\\.{1,3}\
				|[&|\\^]{1,2}|[><!]=|={1,3}|>{1,3}|<{1,3}|\\*\\*\
				|[¬!\\$%^&*()-+=\\[\\]{};:@#~\\|,/?]\
				|\\s+\
				|\\S"
			).unwrap();
			globalCompileContext.source.insert(fileName,s.split("\n").collect::<Vec<&str>>());
			let words:Vec<&str>=WORD_REGEX.find_iter(s)
				.filter_map(|word|Some(word.as_str())) //word.as_str().parse().ok()
				.collect()
			;
			let wordsLen:i64 = words.len().try_into().unwrap();
			//let iter=words.iter();
			let bracketsMap=HashMap::<char,i8>::from([//{} has highest priority
				('(',0),(')',0),
				('[',1),(']',1),
				('{',2),('}',2),
			]);
			fn toTree<'a>(
				bracketsMap:&HashMap<char,i8>,
				index:&usize,
				wordsRef:&Vec<&'a str>,
				wordsLen:i64,
				charPos:&mut CharPos<'a>,
				bracket:i8,
				treeNum:&mut Recur_type
			)->Tree<'a>{
				let mut treeVec = Vec::new();//:Vec<Node>
				let mut i:usize = *index;
				let words = wordsRef;
				let mut forI:i64 = *index as i64;
				let mut addNode=|node:NodeType<'a>,wordType:WordType,charPos:&CharPos<'a>|{//word:&'a str,Type:fn(&str) -> NodeType<'_>){
					treeVec.push(Node::<'a>{node,wordType,pos:charPos.clone()});
				};
				let getBracket=|word:&str|->i8{
					*bracketsMap.get(&word.chars().nth(0).unwrap() as &char).unwrap()
				};
				loop{
					if {forI+=1;forI}>wordsLen || (i as i64)>=wordsLen {break}
					//println!("{:?}",forI.to_string()+&":".to_owned()+&recursion.to_string()+&":".to_owned()+&index.to_string());
					let word = words[i];
					charPos.column+=word.len();
					if "([{".contains(word) {
						i+=1;
						addNode(NodeType::word(word),WordType::bracket_open,&charPos);
						let newTree = toTree(
							&bracketsMap,
							&i,
							wordsRef,
							wordsLen,
							charPos,
							getBracket(word),
							treeNum,
							//recursion+1,
						);
						//allows   [(],[)],{(},{)},{[},{]}
						//prevents ([),(]),({),(}),[{],[}]
						//if words[i].chars().nth(0).unwrap() as char == word {break;}
						addNode(NodeType::tree(newTree),WordType::tree,&charPos);
					}
					else if ")]}".contains(word) {
						let endBracket = getBracket(word);
						let openBracket = bracket;
						if endBracket==openBracket {
							addNode(NodeType::word(word),WordType::bracket_close,&charPos);
						}
						if endBracket>=openBracket {break}

					}
					else if Regex::new(r"\w+").unwrap().is_match(word) {
						i+=1;
						addNode(NodeType::word(word),WordType::word,&charPos);
					}
					//comment or blank space
					else if Regex::new(r"^(/[/*]|\s)").unwrap().is_match(word) {
						i+=1;
						{
							charPos.line+=Regex::new(r"\n")
								.unwrap()
								.find_iter(word)
								.count()
							;
							charPos.column=Regex::new(r".*$")
								.unwrap()
								.find_iter(word)
								.count()
							;
						}
					}
					else {
						i+=1;
						addNode(NodeType::word(word),WordType::any,&charPos);
					}
				}
				let tree = Tree{vec:treeVec,recur:HashMap::new(),num:*treeNum};
				*treeNum+=1;
				tree
			}
			toTree(
				&bracketsMap,
				&(0 as usize),
				&words,
				wordsLen,
				&mut CharPos{line:0,column:0,fileName},
				*bracketsMap.get(&'{').unwrap(),
				&mut globalCompileContext.treeNum,
			)
			/*let a:Tree;
			let mut b = Vec::new();
			b.push(Node::string("asd"));
			a = Tree(b);
			a//unimplemented!();*/
		}
	}
	pub mod metaPhase{
		#![allow(unused_imports)]
		use regex::Regex;
		use super::{wordTree::{self, throw, ErrorType, Tree, Node, NodeType, WordType}, GlobalCompileContext};
		use std::collections::HashMap;
		type SyntaxTree<'a> = wordTree::Tree<'a>;
		#[derive(Debug)]
		struct Lambda<'a>{
			context:Context<'a>,
			paramName:Option<&'a str>,
			recurName:Option<&'a str>,
			source:&'a Node<'a>,
		}
		#[derive(Debug)]
		struct FunctionCall<'a>{
			arg:&'a SyntaxTree<'a>,
			recur:Option<&'a SyntaxTree<'a>>,
		}
		//
			#[derive(Debug)]
			enum FuncNode<'a>{
				call(FunctionCall<'a>),
				lambda(Lambda<'a>),
				block(Vec<FuncNode<'a>>),
			}
			struct Func<'a>{//same as Func in my JS version
				vec:Vec<FuncNode<'a>>,
			}
			impl Func<'_>{
				fn new<'a>()->Func<'a>{
					Func{//context
						vec:Vec::new(),
					}
				}
				// add code here
			}
		//---
		#[derive(Debug)]
		enum Variable<'a>{
			lambda(Lambda<'a>),
		}
		#[derive(Debug)]
		struct AsmPart{

		}
		#[derive(Debug)]
		#[derive(Clone)]
		struct Context<'a>{//context
			parent:Option<&'a Context<'a>>,//'(a=0,(a=1))'
			previous:Option<&'a Context<'a>>,//'(a=0,a=1)'
			labels:HashMap<&'a str,&'a Variable<'a>>,
		}
		impl Context <'_>{
			fn new<'a>(parent:Option<&'a Context<'a>>,previous:Option<&'a Context<'a>>)->Context<'a>{
				Context{//context
					parent,
					previous,
					labels:HashMap::new(),
				}
			}
			fn has(self,valName:&str)->bool{
				self.labels.contains_key(valName)
			}
			/*fn getValue(self,valName:&str)->Option<&Variable>{
				if self.has(valName) {Some(*self.labels.get(valName).unwrap())}
				else {
					match self.parent {
						Some(parent) => parent.getValue(valName),
						None => None,
					}
				}
			}*/
			/*fn addLabel<'a>(self,name:&str,obj:&Variable<'a>,){
				if self.labels.contains_key(name){
					let newContext = self.clone();
					newContext.labels.insert(name, obj);
					newContext;
				}
				else {
					self.labels.insert(name, obj);
					self;
				}
			}*/
		}
		type Stack<'a> = Vec<Node<'a>>;
		//I spent an entire day trying to use this function. Don't use unless you know how to do `{let a,foo=obj=>{a=obj}}` in rust
		fn parseNodes<'a,'b, I, F>(iter:&'a mut I,parser:&mut F)
		where
			I: Iterator<Item = &'a Node<'a>> + 'a,
			F: FnMut (&str,&Node,&mut I)->bool
		{
			loop {
				let node;
				match iter.next(){
					None =>{break;}
					Some(nodeObj) => {node = nodeObj;}
				}
				match node.node{
					NodeType::word(word)=>{
						if !parser(word,node,iter) {break}
					}
					_=>{
						panic!("{:?}","invalid code");
					}
				}
				
			}
		}
		#[allow(unused_variables)]
		fn parse_main<'a,T>(globalCompileContext:&GlobalCompileContext,code:wordTree::Tree<'a>,contextIn:Context<'a>,stack:Stack)->(Context<'a>,Func<'a>){// #{}
			let maxLen = 3;
			let mut func = Func::new();
			let mut context = contextIn;
			let mut lastNodes:Vec<(&str,Node)>=vec![
				("",Node::NULL),
				("",Node::NULL),
				("",Node::NULL),
			];
			let mut iter = code.vec.into_iter();
			loop {
				let node;
				match iter.next(){
					None =>{break;}
					Some(nodeObj) => {node = nodeObj;}
				}
				match node.node{
					NodeType::word(word)=>{
						let addLabel=|name:&'a str,obj:&'a Variable|{
							if context.labels.contains_key(name){
								context = context.clone();
								context.labels.insert(name, obj);
							}
							else {
								context.labels.insert(name, obj);
							}
						};
						if word == ">"{
							if  lastNodes[0].1.wordType == WordType::word {//'a>' or 'a:r>'
								let param;
								let mut recur=None;
								if 
									lastNodes[1].0 == "::"
								{
									if lastNodes[2].1.wordType == WordType::word
									{//'a::r>'
										param = lastNodes[2].0;
										recur = Some(lastNodes[0].0);
									}
									else{
										param = "";
										throw(globalCompileContext, node, 
											"errorType",
											 "expected parameter before '::'"
										);
									}
								}
								else
								{//'a>'
									param = lastNodes[0].0;
								}
								func.vec.push(
									FuncNode::lambda(
										Lambda{
											context:context.clone(),
											source:&node,
											paramName:Some(param),
											recurName:recur,
										}
									)
								);

							}//'?>'
							else{
								throw(globalCompileContext, node, 
									"errorType",
									 "expected parameter before '>'"
								);
							}
						}
						lastNodes.insert(0,(word,node));
						if lastNodes.len()>maxLen {lastNodes.remove(maxLen);}
					}
					_=>{
						panic!("{:?}","invalid code");
					}
				}
			}
			(context,func)
		}
		// pub enum FileType<'a>{
		// 	string(&'a str),//: &str
		// 	tree(wordTree::Tree<'a>),
		// 	meta,// json like data
		// 	asm,// 
		// 	bin,//
		// }
		// pub fn import(fileName:&str,asType:FileType){
		// 	unimplemented!();
		// }
	}
	#[allow(unused_variables)]
	fn openFile(fileName:&str)->&str{
		unimplemented!();
	}
	#[allow(unused_variables)]
	pub fn main(fileStr:&str){
		let globalCompileContext=GlobalCompileContext::new();
		unimplemented!();
	}
}
#[allow(dead_code)]
fn test(){
	#![allow(unused_mut)]
	#![allow(unused_variables)]
	#![allow(unused_assignments)]
	fn foo(a:&mut Vec<i64>){bar(a)}
	fn bar(a:&mut Vec<i64>){}
	let mut int: Vec<i64>=vec![];
	foo(&mut int);
	bar(&mut int);
}
fn main() {
	#![allow(dead_code)]
	#![allow(unused_variables)]
	#![allow(non_snake_case)]
	let syntaxTree = compile::main("a>{}");
	println!("{:?}",syntaxTree);
}