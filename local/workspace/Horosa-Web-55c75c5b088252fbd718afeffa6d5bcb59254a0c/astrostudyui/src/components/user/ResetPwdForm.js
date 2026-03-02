import { Component } from 'react';
import { Form, Input, Button, Select,  TimePicker, Row, Col,  } from 'antd';
import { UserOutlined, } from '@ant-design/icons';
import { preventEnterPress } from '../../utils/helper';
import { EmailRegex } from '../../utils/constants'
import ImgToken from '../comp/ImgToken';

export default function ResetPwdForm(props){
	const [form] = Form.useForm();
    const FormItem = Form.Item;
    const Option = Select.Option;

	function formFieldsChanged(changedFields, allFields){
        if(props.dispatch){
			let values = {
				registerFields: {
					...props.fields,
				},
			};
			for(let fld of allFields){
				let key = fld.name[0];
				values.registerFields[key].value = fld.value;
			}
			
			props.dispatch({
				type: 'app/save',
				payload:{ 
					...values,
				},
			});	
		}
	}
	
	function handleSubmit(values){
		if(props.dispatch){
			props.dispatch({
				type: 'app/resetPwd',
				payload:{ 
					...values,
				},
			});
		}
	}
	
	function clickTokenImg(){
		if(props.dispatch){
			props.dispatch({
				type: 'app/fetchImgToken',
				payload:{},
			});
		}
	}
	
	function getToken(val){
		if(props.dispatch){
			props.dispatch({
				type: 'app/save',
				payload:{
					...val,
				},
			});
		}
	}
	
	return (
		<div>
			<Form onFinish={handleSubmit} onKeyPress={preventEnterPress}
				onFieldsChange={formFieldsChanged}
                fields={props.fieldsAry}
                form={form}
			>
				<FormItem
					name='loginId'
					rules={[{ 
						required: true, 
						pattern: EmailRegex,
						message: '请输入您有效的email' 
					}]}
				>
					<Input prefix={<UserOutlined style={{ color: 'rgba(0,0,0,.25)' }} />} placeholder="有效的email" />
				</FormItem>
				
				<FormItem
					name='imgToken'
					rules={[{ required: true, message: '请输入验证码！' }]}
				>
					<ImgToken onGetToken={getToken} />
				</FormItem>

				<FormItem>
					<Button type="primary" htmlType="submit">
						提&nbsp;交
					</Button>
				</FormItem>

			</Form>

		</div>
	);
    
}

